import { NextResponse } from "next/server";
import { renderToBuffer, Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { format } from "date-fns";
import { getSessionProfile } from "@/lib/auth";
import {
  getMemoForUser,
  getOrg,
  listSteps,
  listComments,
  listAttachments,
  listEvents,
  profilesMap,
  listDepartments,
  listCategories,
} from "@/lib/data";

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
  const profile = await getSessionProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Tenant + visibility check happens in getMemoForUser.
  const memo = await getMemoForUser(params.id, profile);
  if (!memo) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [org, steps, comments, attachments, events, people, departments, categories] =
    await Promise.all([
      getOrg(memo.orgId),
      listSteps(memo.id),
      listComments(memo.id),
      listAttachments(memo.id),
      listEvents(memo.id),
      profilesMap(memo.orgId),
      listDepartments(memo.orgId),
      listCategories(memo.orgId),
    ]);

  const name = (uid: string | null | undefined) =>
    uid ? (people.get(uid)?.fullName ?? "Unknown") : "Unknown";
  const deptName = memo.departmentId
    ? departments.find((d) => d.id === memo.departmentId)?.name
    : null;
  const catName = memo.categoryId
    ? categories.find((c) => c.id === memo.categoryId)?.name
    : null;

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
          {org?.identifier}
          {org?.contactEmail ? ` · ${org.contactEmail}` : ""}
        </Text>

        <Text style={styles.title}>{memo.subject}</Text>

        <View style={styles.section}>
          <View style={styles.row}>
            <Text style={styles.label}>Memo Number</Text>
            <Text>{memo.memoNumber ?? "—"}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Author</Text>
            <Text>{name(memo.authorId)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Department</Text>
            <Text>{deptName ?? "—"}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Category</Text>
            <Text>{catName ?? "—"}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Priority</Text>
            <Text>{memo.priority}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Date</Text>
            <Text>{format(new Date(memo.createdAt), "PPP")}</Text>
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

        {attachments.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.heading}>Attachments</Text>
            {attachments.map((a, i) => (
              <Text key={i} style={styles.item}>
                • {a.filename} ({Math.round(a.sizeBytes / 1024)} KB)
              </Text>
            ))}
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.heading}>Workflow Participants</Text>
          {steps.map((s) => (
            <Text key={s.id} style={styles.item}>
              {s.order}. {name(s.assignedUserId)}
              {" — "}
              {s.status === "Active" ? "Pending (current step)" : s.status}
              {s.actedAt ? ` on ${format(new Date(s.actedAt), "PP p")}` : ""}
            </Text>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>Approval History</Text>
          {events.map((e) => (
            <Text key={e.id} style={styles.item}>
              {format(new Date(e.createdAt), "PP p")} — {name(e.actorId)}
              {e.onBehalfOf ? ` (on behalf of ${name(e.onBehalfOf)})` : ""}{" "}
              {e.action}
              {e.versionNumber ? ` (version ${e.versionNumber})` : ""}
              {e.comment ? ` — "${e.comment}"` : ""}
            </Text>
          ))}
        </View>

        {comments.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.heading}>Comments</Text>
            {comments.map((c) => (
              <Text key={c.id} style={styles.item}>
                {name(c.authorId)} ({c.type.replace("_", " ")},{" "}
                {format(new Date(c.createdAt), "PP p")}): {c.body}
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
      "Content-Disposition": `inline; filename="${memo.memoNumber ?? "memo"}.pdf"`,
    },
  });
}
