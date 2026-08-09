const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, '..', 'src', 'pages')

const replacements = {
  'admin': {
    importOld: "import { Layout } from '../../components/Layout'",
    importNew: "import AdminLayout from '../../components/AdminLayout'",
    openOld: '<Layout role="admin">',
    openNew: '<AdminLayout>',
    closeOld: '</Layout>',
    closeNew: '</AdminLayout>',
  },
  'teacher': {
    importOld: "import { Layout } from '../../components/Layout'",
    importNew: "import TeacherLayout from '../../components/TeacherLayout'",
    openOld: '<Layout role="teacher">',
    openNew: '<TeacherLayout>',
    closeOld: '</Layout>',
    closeNew: '</TeacherLayout>',
  },
  'student': {
    importOld: "import { Layout } from '../../components/Layout'",
    importNew: "import StudentLayout from '../../components/StudentLayout'",
    openOld: '<Layout role="student">',
    openNew: '<StudentLayout>',
    closeOld: '</Layout>',
    closeNew: '</StudentLayout>',
  },
}

for (const [dirName, rep] of Object.entries(replacements)) {
  const dir = path.join(root, dirName)
  if (!fs.existsSync(dir)) continue
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.tsx'))
  for (const file of files) {
    const fp = path.join(dir, file)
    let c = fs.readFileSync(fp, 'utf8')
    if (!c.includes("components/Layout")) continue
    c = c.split(rep.importOld).join(rep.importNew)
    c = c.split(rep.openOld).join(rep.openNew)
    c = c.split(rep.closeOld).join(rep.closeNew)
    fs.writeFileSync(fp, c)
    console.log('Updated', path.join(dirName, file))
  }
}
console.log('Done')
