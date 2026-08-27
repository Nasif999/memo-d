import { NextResponse } from "next/server";
import { renderToBuffer, Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica" },
  orgName: { fontSize: 16, fontFamily: "Helvetica-Bold" },
  title: { fontSize: 13, fontFamily: "Helvetica-Bold", marginTop: 14 },
  meta: { color: "#555", marginTop: 2 },
  section: { marginTop: 12 },
  heading: { fontSize: 11, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  row: { flexDirection: "row", marginBottom: 2 },
  label: { width: 110, color: "#555" },
  body: { marginTop: 4, lineHeight: 1.5 },
  stamp: { marginTop: 16, padding: 8, borderWidth: 2, alignSelf: "flex-start", fontFamily: "Helvetica-Bold", fontSize: 12 },
  item: { marginBottom: 5 },
});

function stripHtml(html: string) {
  return html
    .replace(/<\/(p|div|h[1-6]|li|blockquote)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // All queries below run under the caller's RLS — cross-org access returns nothing.
  const { data: memo } = await supabase
    .from("memos")
    .select(
      `*,
       author:profiles!memos_author_id_fkey(full_name, designation),
       department:departments(name),
       category:memo_categories(name),
       org:orgs(name, identifier, contact_email)`
    )
    .eq("id", params.id)
    .single();
  if (!memo) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [{ data: steps }, { data: comments }, { data: attachments }] =
    await Promise.all([
      supabase
        .from("workflow_instance_steps")
        .select("*, assignee:profiles!workflow_instance_steps_assigned_user_id_fkey(full_name, designation)")
        .eq("memo_id", params.id)
        .order("step_order"),
      supabase
        .from("comments")
        .select("*, author:profiles!comments_author_id_fkey(full_name)")
        .eq("memo_id", params.id)
        .order("created_at"),
      supabase
        .from("attachments")
        .select("filename, size_bytes")
        .eq("memo_id", params.id),
    ]);

  const org = memo.org as unknown as { name: string; identifier: string; contact_email: string | null };
  const finalStatus =
    memo.status === "Approved" ? "APPROVED"
    : memo.status === "Rejected" ? "REJECTED"
    : memo.status === "Cancelled" ? "CANCELLED"
    : "IN PROGRESS";
  const stampColor =
    finalStatus === "APPROVED" ? "#15803d"
    : finalStatus === "REJECTED" ? "#b91c1c"
    : "#a16207";

  const pdf = (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.orgName}>{org?.name}</Text>
        <Text style={styles.meta}>
          {org?.identifier}{org?.contact_email ? ` · ${org.contact_email}` : ""}
        </Text>

        <Text style={styles.title}>{memo.subject}</Text>

        <View style={styles.section}>
          <View style={styles.row}>
            <Text style={styles.label}>Memo Number</Text>
            <Text>{memo.memo_number ?? "—"}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Author</Text>
            <Text>
              {(memo.author as { full_name: string; designation: string | null } | null)?.full_name}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Department</Text>
            <Text>{(memo.department as { name: string } | null)?.name ?? "—"}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Category</Text>
            <Text>{(memo.category as { name: string } | null)?.name ?? "—"}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Priority</Text>
            <Text>{memo.priority}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Date</Text>
            <Text>{format(new Date(memo.created_at), "PPP")}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Status</Text>
            <Text>{memo.status}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>Memo Body</Text>
          <Text style={styles.body}>{stripHtml(memo.body)}</Text>
        </View>

        {(attachments ?? []).length > 0 && (
          <View style={styles.section}>
            <Text style={styles.heading}>Attachments</Text>
            {(attachments ?? []).map((a, i) => (
              <Text key={i} style={styles.item}>
                • {a.filename} ({Math.round(a.size_bytes / 1024)} KB)
              </Text>
            ))}
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.heading}>Workflow & Approval History</Text>
          {(steps ?? []).map((s) => (
            <Text key={s.id} style={styles.item}>
              {s.step_order}. {(s.assignee as { full_name: string; designation: string | null } | null)?.full_name}
              {(s.assignee as { designation: string | null } | null)?.designation
                ? ` (${(s.assignee as { designation: string | null }).designation})` : ""}
              {" — "}
              {s.status === "Active" ? "Pending (current step)" : s.status}
              {s.acted_at ? ` on ${format(new Date(s.acted_at), "PP p")}` : ""}
              {s.comment ? ` — "${s.comment}"` : ""}
            </Text>
          ))}
        </View>

        {(comments ?? []).length > 0 && (
          <View style={styles.section}>
            <Text style={styles.heading}>Comments</Text>
            {(comments ?? []).map((c) => (
              <Text key={c.id} style={styles.item}>
                {(c.author as { full_name: string } | null)?.full_name} (
                {c.comment_type.replace("_", " ")},{" "}
                {format(new Date(c.created_at), "PP p")}): {c.body}
              </Text>
            ))}
          </View>
        )}

        <Text style={[styles.stamp, { color: stampColor, borderColor: stampColor }]}>
          {finalStatus}
        </Text>
      </Page>
    </Document>
  );

  const buffer = await renderToBuffer(pdf);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${memo.memo_number ?? "memo"}.pdf"`,
    },
  });
}
