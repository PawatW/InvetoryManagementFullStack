import { PrismaClient, Role, AssignmentType, SubmissionStatus } from "@prisma/client"
import bcrypt from "bcryptjs"

const db = new PrismaClient()

const ago = (days: number) => new Date(Date.now() - days * 86_400_000)

// ── helpers ──────────────────────────────────────────────────────────────────

async function gradedSub(
  assignmentId: string,
  studentId: string,
  instructorId: string,
  score: number,
  maxScore: number,
  dueDate: Date,
  opts: {
    isLate?: boolean
    rubricScores?: Record<string, number>
    privateNote?: string
    fileName?: string
  } = {}
) {
  const submittedAt = opts.isLate
    ? new Date(dueDate.getTime() + 2 * 86_400_000)
    : new Date(dueDate.getTime() - 86_400_000)

  const pct = score / maxScore
  const note =
    pct >= 0.85
      ? "ยอดเยี่ยม! ทำได้ดีมากครับ ผลลัพธ์ถูกต้องครบถ้วน"
      : pct >= 0.70
      ? "ดีครับ ผ่านเกณฑ์ได้ดี"
      : pct >= 0.55
      ? "ผ่านเกณฑ์ แต่ต้องทบทวนเนื้อหาบางส่วน"
      : "ควรปรับปรุง กรุณาทบทวนเนื้อหาและขอนัดพบอาจารย์"

  const sub = await db.submission.create({
    data: {
      assignmentId,
      studentId,
      submittedAt,
      status: SubmissionStatus.GRADED,
      isLate: opts.isLate ?? false,
      fileName: opts.fileName ?? "submission.pdf",
      studentNote: opts.isLate ? "ขอโทษที่ส่งช้าครับ/ค่ะ มีปัญหาด้านสุขภาพ" : null,
    },
  })

  await db.grade.create({
    data: {
      submissionId: sub.id,
      gradedById: instructorId,
      score,
      instructorNote: note,
      privateNote: opts.privateNote ?? null,
      rubricScores: opts.rubricScores ?? undefined,
      gradedAt: new Date(submittedAt.getTime() + 3 * 86_400_000),
    },
  })

  return sub
}

async function pendingSub(
  assignmentId: string,
  studentId: string,
  dueDate: Date,
  isLate = false,
  fileName = "submission.pdf"
) {
  const submittedAt = isLate
    ? new Date(dueDate.getTime() + 2 * 86_400_000)
    : new Date(dueDate.getTime() - 86_400_000)

  return db.submission.create({
    data: {
      assignmentId,
      studentId,
      submittedAt,
      status: isLate ? SubmissionStatus.LATE : SubmissionStatus.SUBMITTED,
      isLate,
      fileName,
      studentNote: isLate ? "ขอโทษที่ส่งช้าครับ/ค่ะ" : null,
    },
  })
}

// ── main ──────────────────────────────────────────────────────────────────────

async function main() {
  // Clear existing data
  await db.notification.deleteMany()
  await db.grade.deleteMany()
  await db.submission.deleteMany()
  await db.rubricCriteria.deleteMany()
  await db.assignment.deleteMany()
  await db.enrollment.deleteMany()
  await db.course.deleteMany()
  await db.user.deleteMany()

  // ── Passwords ─────────────────────────────────────────────────────────────
  const [adminPw, instPw, stdPw] = await Promise.all([
    bcrypt.hash("admin123", 10),
    bcrypt.hash("inst123", 10),
    bcrypt.hash("std123", 10),
  ])

  // ── Users ─────────────────────────────────────────────────────────────────
  await db.user.create({
    data: { name: "Admin System", email: "admin@uni.ac.th", password: adminPw, role: Role.ADMIN },
  })

  const [smith, jones] = await Promise.all([
    db.user.create({ data: { name: "Dr. Smith", email: "smith@uni.ac.th", password: instPw, role: Role.INSTRUCTOR } }),
    db.user.create({ data: { name: "Dr. Jones", email: "jones@uni.ac.th", password: instPw, role: Role.INSTRUCTOR } }),
  ])

  // 6 students with varied performance profiles
  const [alice, bob, charlie, diana, edward, fiona] = await Promise.all([
    db.user.create({ data: { name: "Alice Wonderland", email: "student1@uni.ac.th", yearLevel: "ปี 1", password: stdPw, role: Role.STUDENT } }),
    db.user.create({ data: { name: "Bob Builder",      email: "student2@uni.ac.th", yearLevel: "ปี 2", password: stdPw, role: Role.STUDENT } }),
    db.user.create({ data: { name: "Charlie Chaplin",  email: "student3@uni.ac.th", yearLevel: "ปี 3", password: stdPw, role: Role.STUDENT } }),
    db.user.create({ data: { name: "Diana Prince",     email: "student4@uni.ac.th", yearLevel: "ปี 1", password: stdPw, role: Role.STUDENT } }),
    db.user.create({ data: { name: "Edward Norton",    email: "student5@uni.ac.th", yearLevel: "ปี 2", password: stdPw, role: Role.STUDENT } }),
    db.user.create({ data: { name: "Fiona Green",      email: "student6@uni.ac.th", yearLevel: "ปี 3", password: stdPw, role: Role.STUDENT } }),
  ])

  // ── Courses ───────────────────────────────────────────────────────────────
  const [cs101, cs201, math101] = await Promise.all([
    db.course.create({ data: { code: "CS101", title: "Introduction to Programming", instructorId: smith.id, semester: "1/2567", year: 2024 } }),
    db.course.create({ data: { code: "CS201", title: "Data Structures and Algorithms", instructorId: smith.id, semester: "1/2567", year: 2024 } }),
    db.course.create({ data: { code: "MATH101", title: "Calculus I", instructorId: jones.id, semester: "1/2567", year: 2024 } }),
  ])

  // ── CS101 Assignments (total weight = 70) ─────────────────────────────────
  // Enrolled: alice, bob, charlie, diana
  const [a_hw1, a_hw2, a_quiz1, a_mid, a_proj] = await Promise.all([
    db.assignment.create({ data: { courseId: cs101.id, title: "HW1: Variables and Data Types",      description: "Basic exercises on variables, operators, and data types.", type: AssignmentType.HOMEWORK, weight: 5,  maxScore: 100, dueDate: ago(50), allowLate: true  } }),
    db.assignment.create({ data: { courseId: cs101.id, title: "HW2: Control Flow",                 description: "Loops, conditionals, and functions.", type: AssignmentType.HOMEWORK, weight: 5,  maxScore: 100, dueDate: ago(35), allowLate: true  } }),
    db.assignment.create({ data: { courseId: cs101.id, title: "Quiz 1: Programming Basics",        description: "In-class quiz covering weeks 1–4.", type: AssignmentType.QUIZ,     weight: 10, maxScore: 20,  dueDate: ago(28), allowLate: false } }),
    db.assignment.create({ data: { courseId: cs101.id, title: "Midterm Examination",               description: "Covers all topics from weeks 1–8.", type: AssignmentType.MIDTERM,  weight: 30, maxScore: 100, dueDate: ago(14), allowLate: false } }),
    db.assignment.create({ data: { courseId: cs101.id, title: "Final Project: Simple Application", description: "Build a console-based application using Python.", type: AssignmentType.PROJECT, weight: 20, maxScore: 100, dueDate: ago(3), allowLate: true  } }),
  ])

  // Rubric for Final Project
  const [rFun, rCode, rDoc, rPres] = await Promise.all([
    db.rubricCriteria.create({ data: { assignmentId: a_proj.id, label: "Functionality",  maxPoints: 40, order: 1 } }),
    db.rubricCriteria.create({ data: { assignmentId: a_proj.id, label: "Code Quality",   maxPoints: 30, order: 2 } }),
    db.rubricCriteria.create({ data: { assignmentId: a_proj.id, label: "Documentation",  maxPoints: 20, order: 3 } }),
    db.rubricCriteria.create({ data: { assignmentId: a_proj.id, label: "Presentation",   maxPoints: 10, order: 4 } }),
  ])

  // ── CS201 Assignments (total weight = 85) ─────────────────────────────────
  // Enrolled: alice, bob, charlie
  const [b_hw1, b_quiz1, b_mid, b_final] = await Promise.all([
    db.assignment.create({ data: { courseId: cs201.id, title: "HW1: Arrays and Linked Lists", type: AssignmentType.HOMEWORK, weight: 5,  maxScore: 100, dueDate: ago(45), allowLate: true  } }),
    db.assignment.create({ data: { courseId: cs201.id, title: "Quiz 1: Time Complexity",      type: AssignmentType.QUIZ,     weight: 10, maxScore: 20,  dueDate: ago(30), allowLate: false } }),
    db.assignment.create({ data: { courseId: cs201.id, title: "Midterm Examination",          type: AssignmentType.MIDTERM,  weight: 30, maxScore: 100, dueDate: ago(12), allowLate: false } }),
    db.assignment.create({ data: { courseId: cs201.id, title: "Final Examination",            type: AssignmentType.FINAL,    weight: 40, maxScore: 100, dueDate: ago(2),  allowLate: false } }),
  ])

  // ── MATH101 Assignments (total weight = 60) ───────────────────────────────
  // Enrolled: charlie, diana, edward, fiona
  const [c_hw1, c_quiz1, c_mid] = await Promise.all([
    db.assignment.create({ data: { courseId: math101.id, title: "HW1: Limits and Continuity", type: AssignmentType.HOMEWORK, weight: 10, maxScore: 100, dueDate: ago(40), allowLate: true  } }),
    db.assignment.create({ data: { courseId: math101.id, title: "Quiz 1: Derivatives",        type: AssignmentType.QUIZ,     weight: 15, maxScore: 30,  dueDate: ago(25), allowLate: false } }),
    db.assignment.create({ data: { courseId: math101.id, title: "Midterm Examination",        type: AssignmentType.MIDTERM,  weight: 35, maxScore: 100, dueDate: ago(10), allowLate: false } }),
  ])

  // ── Enrollments ───────────────────────────────────────────────────────────
  await db.enrollment.createMany({
    data: [
      // CS101: alice, bob, charlie, diana
      { studentId: alice.id,   courseId: cs101.id },
      { studentId: bob.id,     courseId: cs101.id },
      { studentId: charlie.id, courseId: cs101.id },
      { studentId: diana.id,   courseId: cs101.id },
      // CS201: alice, bob, charlie
      { studentId: alice.id,   courseId: cs201.id },
      { studentId: bob.id,     courseId: cs201.id },
      { studentId: charlie.id, courseId: cs201.id },
      // MATH101: charlie, diana, edward, fiona
      { studentId: charlie.id, courseId: math101.id },
      { studentId: diana.id,   courseId: math101.id },
      { studentId: edward.id,  courseId: math101.id },
      { studentId: fiona.id,   courseId: math101.id },
    ],
  })

  // ── CS101 Submissions ─────────────────────────────────────────────────────
  //
  // Alice  (all 5 graded) → weighted ≈ 87.9%
  await gradedSub(a_hw1.id,  alice.id, smith.id, 92, 100, ago(50))
  await gradedSub(a_hw2.id,  alice.id, smith.id, 88, 100, ago(35))
  await gradedSub(a_quiz1.id,alice.id, smith.id, 18, 20,  ago(28))
  await gradedSub(a_mid.id,  alice.id, smith.id, 85, 100, ago(14))
  await gradedSub(a_proj.id, alice.id, smith.id, 90, 100, ago(3), {
    rubricScores: { [rFun.id]: 36, [rCode.id]: 27, [rDoc.id]: 18, [rPres.id]: 9 },
  })

  // Bob    (all 5 graded, HW2 late) → weighted ≈ 74.1%
  await gradedSub(a_hw1.id,  bob.id, smith.id, 78, 100, ago(50))
  await gradedSub(a_hw2.id,  bob.id, smith.id, 74, 100, ago(35), { isLate: true })
  await gradedSub(a_quiz1.id,bob.id, smith.id, 15, 20,  ago(28))
  await gradedSub(a_mid.id,  bob.id, smith.id, 72, 100, ago(14))
  await gradedSub(a_proj.id, bob.id, smith.id, 76, 100, ago(3), {
    rubricScores: { [rFun.id]: 30, [rCode.id]: 23, [rDoc.id]: 15, [rPres.id]: 8 },
  })

  // Charlie (4 graded + project SUBMITTED pending) → weighted ≈ 47.4% until project graded
  await gradedSub(a_hw1.id,  charlie.id, smith.id, 65, 100, ago(50))
  await gradedSub(a_hw2.id,  charlie.id, smith.id, 60, 100, ago(35))
  await gradedSub(a_quiz1.id,charlie.id, smith.id, 13, 20,  ago(28))
  await gradedSub(a_mid.id,  charlie.id, smith.id, 68, 100, ago(14))
  await pendingSub(a_proj.id, charlie.id, ago(3), false, "final_project_charlie.zip")

  // Diana  (2 graded, 3 missing) → weighted ≈ 6.6%  ← AT RISK
  await gradedSub(a_hw1.id, diana.id, smith.id, 44, 100, ago(50), {
    privateNote: "นักศึกษาคนนี้มีผลการเรียนต่ำมาก ควรพบเพื่อให้คำปรึกษา",
  })
  await gradedSub(a_hw2.id, diana.id, smith.id, 48, 100, ago(35))
  // Diana misses: Quiz1, Midterm, FinalProject

  // ── CS201 Submissions ─────────────────────────────────────────────────────
  //
  // Alice  (all 4 graded) → weighted ≈ 85.4%
  await gradedSub(b_hw1.id,  alice.id, smith.id, 85, 100, ago(45))
  await gradedSub(b_quiz1.id,alice.id, smith.id, 17, 20,  ago(30))
  await gradedSub(b_mid.id,  alice.id, smith.id, 82, 100, ago(12))
  await gradedSub(b_final.id,alice.id, smith.id, 88, 100, ago(2))

  // Bob    (all 4 graded) → weighted ≈ 70.2%
  await gradedSub(b_hw1.id,  bob.id, smith.id, 70, 100, ago(45))
  await gradedSub(b_quiz1.id,bob.id, smith.id, 14, 20,  ago(30))
  await gradedSub(b_mid.id,  bob.id, smith.id, 68, 100, ago(12))
  await gradedSub(b_final.id,bob.id, smith.id, 72, 100, ago(2))

  // Charlie (3 graded + final SUBMITTED pending) → weighted ≈ 29.6% until final graded
  await gradedSub(b_hw1.id,  charlie.id, smith.id, 55, 100, ago(45))
  await gradedSub(b_quiz1.id,charlie.id, smith.id, 10, 20,  ago(30))
  await gradedSub(b_mid.id,  charlie.id, smith.id, 58, 100, ago(12))
  await pendingSub(b_final.id, charlie.id, ago(2))

  // ── MATH101 Submissions ───────────────────────────────────────────────────
  //
  // Charlie (all 3 graded) → weighted ≈ 63.4%
  await gradedSub(c_hw1.id,  charlie.id, jones.id, 63, 100, ago(40))
  await gradedSub(c_quiz1.id,charlie.id, jones.id, 18, 30,  ago(25))
  await gradedSub(c_mid.id,  charlie.id, jones.id, 65, 100, ago(10))

  // Diana  (all 3 graded, low) → weighted ≈ 40.8%  ← AT RISK
  await gradedSub(c_hw1.id,  diana.id, jones.id, 45, 100, ago(40), {
    privateNote: "ผลการเรียนต่ำมาก ควรให้คำปรึกษาเพิ่มเติมโดยเร็ว",
  })
  await gradedSub(c_quiz1.id,diana.id, jones.id, 12, 30,  ago(25))
  await gradedSub(c_mid.id,  diana.id, jones.id, 40, 100, ago(10))

  // Edward (1 graded, 2 missing) → weighted ≈ 9.2%  ← AT RISK
  await gradedSub(c_hw1.id, edward.id, jones.id, 55, 100, ago(40))
  // Edward misses: Quiz1, Midterm

  // Fiona  (all 3 graded) → weighted ≈ 81.2%
  await gradedSub(c_hw1.id,  fiona.id, jones.id, 80, 100, ago(40))
  await gradedSub(c_quiz1.id,fiona.id, jones.id, 24, 30,  ago(25))
  await gradedSub(c_mid.id,  fiona.id, jones.id, 82, 100, ago(10))

  // ── Notifications ─────────────────────────────────────────────────────────
  const notifs = [
    // Alice
    { userId: alice.id,   type: "GRADE_RELEASED",     title: "คะแนนประกาศแล้ว",          message: "คะแนน Final Examination CS201 ของคุณถูกประกาศแล้ว",       read: false, link: `/dashboard/student/courses/${cs201.id}`, createdAt: ago(1) },
    { userId: alice.id,   type: "GRADE_RELEASED",     title: "คะแนน Final Project ออกแล้ว", message: "คะแนน Final Project CS101: 90/100 — ยอดเยี่ยมมาก!",   read: true,  link: `/dashboard/student/courses/${cs101.id}`, createdAt: ago(2) },
    // Bob
    { userId: bob.id,     type: "GRADE_RELEASED",     title: "คะแนนประกาศแล้ว",          message: "คะแนน Final Examination CS201 ของคุณถูกประกาศแล้ว",       read: false, link: `/dashboard/student/courses/${cs201.id}`, createdAt: ago(1) },
    { userId: bob.id,     type: "GRADE_RELEASED",     title: "คะแนน Final Project ออกแล้ว", message: "คะแนน Final Project CS101: 76/100",                     read: false, link: `/dashboard/student/courses/${cs101.id}`, createdAt: ago(2) },
    { userId: bob.id,     type: "ASSIGNMENT_DUE",     title: "งานที่ส่งช้า",              message: "HW2 CS101 ถูกบันทึกว่าส่งช้า กระทบคะแนน",                 read: true,  link: `/dashboard/student/courses/${cs101.id}`, createdAt: ago(34) },
    // Charlie
    { userId: charlie.id, type: "SUBMISSION_RECEIVED",title: "รับงาน CS201 Final แล้ว",   message: "ระบบได้รับ Final Examination CS201 ของคุณเรียบร้อยแล้ว รอการตรวจ", read: false, link: `/dashboard/student/courses/${cs201.id}`, createdAt: ago(2) },
    { userId: charlie.id, type: "SUBMISSION_RECEIVED",title: "รับ Final Project แล้ว",    message: "ระบบได้รับ Final Project CS101 ของคุณแล้ว รอการตรวจ",    read: false, link: `/dashboard/student/courses/${cs101.id}`, createdAt: ago(3) },
    { userId: charlie.id, type: "GRADE_RELEASED",     title: "คะแนน Midterm MATH101",    message: "คะแนน Midterm Examination MATH101: 65/100",               read: true,  link: `/dashboard/student/courses/${math101.id}`, createdAt: ago(7) },
    // Diana
    { userId: diana.id,   type: "GRADE_RELEASED",     title: "คะแนน Midterm MATH101",    message: "คะแนน Midterm Examination MATH101: 40/100 — กรุณาพบอาจารย์", read: false, link: `/dashboard/student/courses/${math101.id}`, createdAt: ago(7) },
    { userId: diana.id,   type: "GRADE_RELEASED",     title: "คะแนน HW1 CS101",          message: "คะแนน HW1: Variables and Data Types: 44/100",             read: false, link: `/dashboard/student/courses/${cs101.id}`, createdAt: ago(47) },
    // Edward
    { userId: edward.id,  type: "GRADE_RELEASED",     title: "คะแนน HW1 MATH101",        message: "คะแนน HW1: Limits and Continuity: 55/100",               read: false, link: `/dashboard/student/courses/${math101.id}`, createdAt: ago(37) },
    { userId: edward.id,  type: "ASSIGNMENT_DUE",     title: "งานค้างส่ง MATH101",        message: "Quiz 1 และ Midterm Examination ยังไม่ได้ส่ง",             read: false, link: `/dashboard/student/courses/${math101.id}`, createdAt: ago(9) },
    // Fiona
    { userId: fiona.id,   type: "GRADE_RELEASED",     title: "คะแนน Midterm MATH101",    message: "คะแนน Midterm Examination MATH101: 82/100 — ดีมาก!",     read: false, link: `/dashboard/student/courses/${math101.id}`, createdAt: ago(7) },
    { userId: fiona.id,   type: "GRADE_RELEASED",     title: "คะแนน Quiz 1 MATH101",     message: "คะแนน Quiz 1: Derivatives: 24/30",                       read: true,  link: `/dashboard/student/courses/${math101.id}`, createdAt: ago(22) },
  ]

  await db.notification.createMany({ data: notifs })

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log("✅ Seed complete")
  console.log("")
  console.log("  Users         : 1 admin · 2 instructors · 6 students")
  console.log("  Courses       : CS101 · CS201 · MATH101")
  console.log("  Assignments   : 5 + 4 + 3 = 12")
  console.log("  Submissions   : 18 graded · 2 pending · 5 missing")
  console.log("  Notifications : 14")
  console.log("")
  console.log("  Test accounts:")
  console.log("    admin@uni.ac.th      / admin123")
  console.log("    smith@uni.ac.th      / inst123   (CS101, CS201)")
  console.log("    jones@uni.ac.th      / inst123   (MATH101)")
  console.log("    student1@uni.ac.th   / std123    (Alice  — high performer)")
  console.log("    student2@uni.ac.th   / std123    (Bob    — average)")
  console.log("    student3@uni.ac.th   / std123    (Charlie — 2 pending submissions)")
  console.log("    student4@uni.ac.th   / std123    (Diana  — AT RISK: score < 50%)")
  console.log("    student5@uni.ac.th   / std123    (Edward — AT RISK: 2 missing)")
  console.log("    student6@uni.ac.th   / std123    (Fiona  — good performer)")
  console.log("")
  console.log("  Analytics highlights:")
  console.log("    CS101  at-risk: Diana (6.6%) · Charlie pending project")
  console.log("    CS201  pending: Charlie final exam (ungraded)")
  console.log("    MATH101 at-risk: Diana (40.8%) · Edward (9.2%, 2 missing)")
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => db.$disconnect())
