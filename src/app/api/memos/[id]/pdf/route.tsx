import { NextResponse } from "next/server";
import { renderToBuffer, Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer";
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

// Fixed letterhead format the org's memo PDFs always follow: cream page,
// serif "OFFICIAL MEMO" masthead beside the org mark, a From/Date/Subject
// block, body, signature, and a rule-and-address footer on every page — the
// full workflow/approval record follows below in the same fixed layout.
const CREAM = "#F4F1EA";
const INK = "#1c1a16";
const MUTED = "#6b6558";
const RULE = "#1c1a16";

const styles = StyleSheet.create({
  page: {
    backgroundColor: CREAM,
    padding: 48,
    paddingBottom: 70,
    fontSize: 10,
    fontFamily: "Times-Roman",
    color: INK,
  },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 28 },
  mark: {
    width: 52, height: 52, borderRadius: 26, borderWidth: 1.5, borderColor: INK,
    alignItems: "center", justifyContent: "center",
  },
  markImage: { width: 52, height: 52, borderRadius: 26 },
  markText: { fontFamily: "Times-Bold", fontSize: 22 },
  masthead: { fontFamily: "Times-Bold", fontSize: 26, letterSpacing: 2 },
  fieldsBlock: { marginBottom: 22 },
  fieldRow: { flexDirection: "row", marginBottom: 3 },
  fieldLabel: { width: 70, fontFamily: "Times-Bold", fontSize: 10.5 },
  fieldValue: { fontSize: 10.5 },
  body: { fontSize: 10.5, lineHeight: 1.6, marginBottom: 22 },
  signOff: { fontSize: 10.5, marginBottom: 4 },
  signName: { fontFamily: "Times-Bold", fontSize: 10.5 },
  signTitle: { fontSize: 10.5, color: MUTED },

  footer: {
    position: "absolute", left: 48, right: 48, bottom: 32,
    flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between",
    borderTopWidth: 1, borderTopColor: RULE, paddingTop: 8,
  },
  footerOrg: { fontFamily: "Times-BoldItalic", fontSize: 13 },
  footerAddr: { fontSize: 9, color: MUTED },

  divider: { borderTopWidth: 1, borderTopColor: "#ddd7c6", marginVertical: 16 },
  section: { marginBottom: 14 },
  heading: {
    fontFamily: "Times-Bold", fontSize: 10.5, marginBottom: 6,
    textTransform: "uppercase", letterSpacing: 1,
  },
  metaGrid: { flexDirection: "row", flexWrap: "wrap" },
  metaCell: { width: "50%", flexDirection: "row", marginBottom: 4 },
  metaLabel: { width: 90, color: MUTED },
  metaValue: {},
  item: { marginBottom: 5, lineHeight: 1.4 },
  stamp: {
    marginTop: 10, padding: 8, borderWidth: 2, alignSelf: "flex-start",
    fontFamily: "Times-Bold", fontSize: 12,
  },
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
  const author = memo.authorId ? people.get(memo.authorId) : null;
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

  const orgInitial = (org?.name?.trim()?.[0] ?? "M").toUpperCase();
  const address = [org?.contactEmail, org?.contactPhone].filter(Boolean).join("  ·  ");

  const Footer = (
    <View style={styles.footer} fixed>
      <Text style={styles.footerOrg}>{org?.name ?? "Memo'd"}</Text>
      {address ? <Text style={styles.footerAddr}>{address}</Text> : null}
    </View>
  );

  const pdf = (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          {org?.logoUrl ? (
            <Image src={org.logoUrl} style={styles.markImage} />
          ) : (
            <View style={styles.mark}>
              <Text style={styles.markText}>{orgInitial}</Text>
            </View>
          )}
          <Text style={styles.masthead}>OFFICIAL MEMO</Text>
        </View>

        <View style={styles.fieldsBlock}>
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>From:</Text>
            <Text style={styles.fieldValue}>{name(memo.authorId)}</Text>
          </View>
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Date:</Text>
            <Text style={styles.fieldValue}>{format(new Date(memo.createdAt), "PPP")}</Text>
          </View>
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Subject:</Text>
            <Text style={styles.fieldValue}>{memo.subject}</Text>
          </View>
        </View>

        <Text style={styles.body}>{stripHtml(memo.body)}</Text>

        <Text style={styles.signOff}>Best,</Text>
        <Text style={styles.signName}>{name(memo.authorId)}</Text>
        {author?.designation ? (
          <Text style={styles.signTitle}>{author.designation}</Text>
        ) : null}

        <View style={styles.divider} />

        <View style={styles.section}>
          <Text style={styles.heading}>Memo Record</Text>
          <View style={styles.metaGrid}>
            <View style={styles.metaCell}>
              <Text style={styles.metaLabel}>Memo No.</Text>
              <Text style={styles.metaValue}>{memo.memoNumber ?? "—"}</Text>
            </View>
            <View style={styles.metaCell}>
              <Text style={styles.metaLabel}>Status</Text>
              <Text style={styles.metaValue}>{memo.status}</Text>
            </View>
            <View style={styles.metaCell}>
              <Text style={styles.metaLabel}>Department</Text>
              <Text style={styles.metaValue}>{deptName ?? "—"}</Text>
            </View>
            <View style={styles.metaCell}>
              <Text style={styles.metaLabel}>Category</Text>
              <Text style={styles.metaValue}>{catName ?? "—"}</Text>
            </View>
            <View style={styles.metaCell}>
              <Text style={styles.metaLabel}>Priority</Text>
              <Text style={styles.metaValue}>{memo.priority}</Text>
            </View>
          </View>
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

        {Footer}
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
