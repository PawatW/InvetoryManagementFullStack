import { PrismaClient, Role, AssignmentType, SubmissionStatus } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

function randomScore(min = 55, max = 95): number {
  return Math.round((Math.random() * (max - min) + min) * 10) / 10
}

function daysAgo(n: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d
}

async function main() {
  await prisma.notification.deleteMany()
  await prisma.grade.deleteMany()
  await prisma.submission.deleteMany()
  await prisma.rubricCriteria.deleteMany()
  await prisma.assignment.deleteMany()
  await prisma.enrollment.deleteMany()
  await prisma.course.deleteMany()
  await prisma.user.deleteMany()

  // ── Users ──────────────────────────────────────────────────────────────
  const adminPw = await bcrypt.hash("admin123", 10)
  const instPw = await bcrypt.hash("inst123", 10)
  const stdPw = await bcrypt.hash("std123", 10)

  const admin = await prisma.user.create({
    data: { name: "Admin", email: "admin@uni.ac.th", password: adminPw, role: Role.ADMIN },
  })

  const smith = await prisma.user.create({
    data: {
      name: "Dr. Smith",
      email: "smith@uni.ac.th",
      password: instPw,
      role: Role.INSTRUCTOR,
    },
  })

  const jones = await prisma.user.create({
    data: {
      name: "Dr. Jones",
      email: "jones@uni.ac.th",
      password: instPw,
      role: Role.INSTRUCTOR,
    },
  })

  const studentData = [
    { name: "Alice Wonderland", email: "student1@uni.ac.th", yearLevel: "ปี 1" },
    { name: "Bob Builder", email: "student2@uni.ac.th", yearLevel: "ปี 2" },
    { name: "Charlie Chaplin", email: "student3@uni.ac.th", yearLevel: "ปี 3" },
    { name: "Diana Prince", email: "student4@uni.ac.th", yearLevel: "ปี 1" },
    { name: "Edward Norton", email: "student5@uni.ac.th", yearLevel: "ปี 2" },
    { name: "Fiona Green", email: "student6@uni.ac.th", yearLevel: "ปี 3" },
  ]

  const students = await Promise.all(
    studentData.map((s) =>
      prisma.user.create({
        data: { ...s, password: stdPw, role: Role.STUDENT },
      })
    )
  )

  // ── Courses ────────────────────────────────────────────────────────────
  const cs101 = await prisma.course.create({
    data: {
      code: "CS101",
      title: "Introduction to Programming",
      instructorId: smith.id,
      semester: "1/2567",
      year: 2024,
    },
  })

  const cs201 = await prisma.course.create({
    data: {
      code: "CS201",
      title: "Data Structures and Algorithms",
      instructorId: smith.id,
      semester: "1/2567",
      year: 2024,
    },
  })

  const math101 = await prisma.course.create({
    data: {
      code: "MATH101",
      title: "Calculus I",
      instructorId: jones.id,
      semester: "1/2567",
      year: 2024,
    },
  })

  // ── Assignments ────────────────────────────────────────────────────────
  const cs101Assignments = await Promise.all([
    prisma.assignment.create({
      data: {
        courseId: cs101.id,
        title: "HW1: Variables and Data Types",
        description: "Basic exercises on variables, operators, and data types.",
        type: AssignmentType.HOMEWORK,
        weight: 5,
        maxScore: 100,
        dueDate: daysAgo(50),
        allowLate: true,
      },
    }),
    prisma.assignment.create({
      data: {
        courseId: cs101.id,
        title: "HW2: Control Flow",
        description: "Loops, conditionals, and functions exercises.",
        type: AssignmentType.HOMEWORK,
        weight: 5,
        maxScore: 100,
        dueDate: daysAgo(35),
        allowLate: true,
      },
    }),
    prisma.assignment.create({
      data: {
        courseId: cs101.id,
        title: "Quiz 1: Programming Basics",
        description: "In-class quiz covering weeks 1–4.",
        type: AssignmentType.QUIZ,
        weight: 10,
        maxScore: 20,
        dueDate: daysAgo(28),
        allowLate: false,
      },
    }),
    prisma.assignment.create({
      data: {
        courseId: cs101.id,
        title: "Midterm Examination",
        description: "Covers all topics from weeks 1–8.",
        type: AssignmentType.MIDTERM,
        weight: 30,
        maxScore: 100,
        dueDate: daysAgo(14),
        allowLate: false,
      },
    }),
    prisma.assignment.create({
      data: {
        courseId: cs101.id,
        title: "Final Project: Simple Application",
        description: "Build a simple console-based application using Python.",
        type: AssignmentType.PROJECT,
        weight: 20,
        maxScore: 100,
        dueDate: daysAgo(3),
        allowLate: true,
      },
    }),
  ])

  const cs201Assignments = await Promise.all([
    prisma.assignment.create({
      data: {
        courseId: cs201.id,
        title: "HW1: Arrays and Linked Lists",
        type: AssignmentType.HOMEWORK,
        weight: 5,
        maxScore: 100,
        dueDate: daysAgo(45),
        allowLate: true,
      },
    }),
    prisma.assignment.create({
      data: {
        courseId: cs201.id,
        title: "Quiz 1: Time Complexity",
        type: AssignmentType.QUIZ,
        weight: 10,
        maxScore: 20,
        dueDate: daysAgo(30),
        allowLate: false,
      },
    }),
    prisma.assignment.create({
      data: {
        courseId: cs201.id,
        title: "Midterm Examination",
        type: AssignmentType.MIDTERM,
        weight: 30,
        maxScore: 100,
        dueDate: daysAgo(12),
        allowLate: false,
      },
    }),
    prisma.assignment.create({
      data: {
        courseId: cs201.id,
        title: "Final Examination",
        type: AssignmentType.FINAL,
        weight: 40,
        maxScore: 100,
        dueDate: daysAgo(2),
        allowLate: false,
      },
    }),
  ])

  const math101Assignments = await Promise.all([
    prisma.assignment.create({
      data: {
        courseId: math101.id,
        title: "HW1: Limits and Continuity",
        type: AssignmentType.HOMEWORK,
        weight: 10,
        maxScore: 100,
        dueDate: daysAgo(40),
        allowLate: true,
      },
    }),
    prisma.assignment.create({
      data: {
        courseId: math101.id,
        title: "Quiz 1: Derivatives",
        type: AssignmentType.QUIZ,
        weight: 15,
        maxScore: 30,
        dueDate: daysAgo(25),
        allowLate: false,
      },
    }),
    prisma.assignment.create({
      data: {
        courseId: math101.id,
        title: "Midterm Examination",
        type: AssignmentType.MIDTERM,
        weight: 35,
        maxScore: 100,
        dueDate: daysAgo(10),
        allowLate: false,
      },
    }),
  ])

  // ── Rubric Criteria (for Project assignment) ───────────────────────────
  await Promise.all([
    prisma.rubricCriteria.create({
      data: { assignmentId: cs101Assignments[4].id, label: "Functionality", maxPoints: 40, order: 1 },
    }),
    prisma.rubricCriteria.create({
      data: { assignmentId: cs101Assignments[4].id, label: "Code Quality", maxPoints: 30, order: 2 },
    }),
    prisma.rubricCriteria.create({
      data: { assignmentId: cs101Assignments[4].id, label: "Documentation", maxPoints: 20, order: 3 },
    }),
    prisma.rubricCriteria.create({
      data: { assignmentId: cs101Assignments[4].id, label: "Presentation", maxPoints: 10, order: 4 },
    }),
  ])

  // ── Enrollments ────────────────────────────────────────────────────────
  // CS101: student1-4
  const cs101Students = students.slice(0, 4)
  // CS201: student1-3
  const cs201Students = students.slice(0, 3)
  // MATH101: student3-6
  const math101Students = students.slice(2, 6)

  await Promise.all([
    ...cs101Students.map((s) =>
      prisma.enrollment.create({ data: { studentId: s.id, courseId: cs101.id } })
    ),
    ...cs201Students.map((s) =>
      prisma.enrollment.create({ data: { studentId: s.id, courseId: cs201.id } })
    ),
    ...math101Students.map((s) =>
      prisma.enrollment.create({ data: { studentId: s.id, courseId: math101.id } })
    ),
  ])

  // ── Submissions + Grades ───────────────────────────────────────────────
  // Each student submits 70% of assignments (floor). Alternate students get a late submission.
  async function createSubmissionsAndGrades(
    courseStudents: typeof students,
    assignments: { id: string; dueDate: Date }[],
    instructorId: string
  ) {
    const submitCount = Math.floor(assignments.length * 0.7)

    for (const [si, student] of courseStudents.entries()) {
      // Pick which assignments this student submits (first submitCount)
      const toSubmit = assignments.slice(0, submitCount)

      for (const [ai, assignment] of toSubmit.entries()) {
        const isLate = ai === toSubmit.length - 1 && si % 2 === 0
        const submittedAt = isLate
          ? new Date(assignment.dueDate.getTime() + 2 * 24 * 60 * 60 * 1000) // 2 days late
          : new Date(assignment.dueDate.getTime() - 1 * 24 * 60 * 60 * 1000) // 1 day early

        const submission = await prisma.submission.create({
          data: {
            assignmentId: assignment.id,
            studentId: student.id,
            submittedAt,
            status: isLate ? SubmissionStatus.GRADED : SubmissionStatus.GRADED,
            isLate,
            fileName: `submission_${student.email.split("@")[0]}.pdf`,
            studentNote: isLate ? "ขอโทษที่ส่งช้าครับ/ค่ะ" : null,
          },
        })

        const score = randomScore()
        await prisma.grade.create({
          data: {
            submissionId: submission.id,
            gradedById: instructorId,
            score,
            instructorNote: score >= 80 ? "ทำได้ดีมาก" : score >= 65 ? "ผ่านเกณฑ์" : "ควรปรับปรุง",
            gradedAt: new Date(submittedAt.getTime() + 3 * 24 * 60 * 60 * 1000),
          },
        })
      }
    }
  }

  await createSubmissionsAndGrades(cs101Students, cs101Assignments, smith.id)
  await createSubmissionsAndGrades(cs201Students, cs201Assignments, smith.id)
  await createSubmissionsAndGrades(math101Students, math101Assignments, jones.id)

  // ── Notifications ──────────────────────────────────────────────────────
  const allStudents = [...cs101Students, ...cs201Students.slice(0, 0), ...math101Students]
  const uniqueStudents = Array.from(new Map(allStudents.map((s) => [s.id, s])).values())

  for (const student of uniqueStudents) {
    await prisma.notification.createMany({
      data: [
        {
          userId: student.id,
          type: "GRADE_RELEASED",
          title: "คะแนนประกาศแล้ว",
          message: "คะแนน Midterm ของคุณถูกประกาศแล้ว กรุณาตรวจสอบ",
          read: false,
          link: "/dashboard/student/grades",
          createdAt: daysAgo(5),
        },
        {
          userId: student.id,
          type: "ASSIGNMENT_DUE",
          title: "ใกล้ถึงกำหนดส่งงาน",
          message: "Final Project มีกำหนดส่งใน 3 วัน",
          read: false,
          link: "/dashboard/student/assignments",
          createdAt: daysAgo(6),
        },
        {
          userId: student.id,
          type: "SUBMISSION_RECEIVED",
          title: "รับงานแล้ว",
          message: "ระบบได้รับไฟล์งานของคุณเรียบร้อยแล้ว",
          read: true,
          link: "/dashboard/student/submissions",
          createdAt: daysAgo(10),
        },
      ],
    })
  }

  console.log("✅ Seed complete")
  console.log(`   Users:         ${2 + 2 + 6} (1 admin, 2 instructors, 6 students)`)
  console.log(`   Courses:       3 (CS101, CS201, MATH101)`)
  console.log(`   Assignments:   ${cs101Assignments.length + cs201Assignments.length + math101Assignments.length}`)
  console.log(`   Submissions:   ~${(cs101Students.length + cs201Students.length + math101Students.length) * Math.floor(3 * 0.7)} graded`)
  console.log(`   Notifications: ${uniqueStudents.length * 3}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
