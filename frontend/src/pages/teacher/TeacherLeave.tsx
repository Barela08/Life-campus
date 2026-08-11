import TeacherLayout from '../../components/TeacherLayout'
import LeavePage from '../LeavePage'

// Teachers manage only their own leave. Leave review is an administrator action.
export default function TeacherLeave() {
  return <TeacherLayout><LeavePage role="teacher" /></TeacherLayout>
}
