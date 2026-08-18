import React, { useEffect, useState } from 'react'
import api from '../../lib/api'
import AdminLayout from '../../components/AdminLayout'
import { PageHeader, Badge, Loading, Empty } from '../../components/ui'
import { ShieldCheck, Plus, Edit3, Trash2, Check, X, Shield, Lock, Layers } from 'lucide-react'
import toast from 'react-hot-toast'

interface Permission {
  id: number
  code: string
  description: string
}

interface Role {
  id: number
  name: string
  description: string
  permission_ids: number[]
}

export default function RolesPermissions() {
  const [roles, setRoles] = useState<Role[]>([])
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [loading, setLoading] = useState(true)

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingRole, setEditingRole] = useState<Role | null>(null)
  const [formName, setFormName] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [selectedPermissionIds, setSelectedPermissionIds] = useState<number[]>([])
  const [saving, setSaving] = useState(false)

  const loadData = async () => {
    setLoading(true)
    try {
      const [rRes, pRes] = await Promise.all([
        api.get('/roles'),
        api.get('/roles/permissions')
      ])
      setRoles(rRes.data)
      setPermissions(pRes.data)
    } catch {
      toast.error('Failed to load roles & permissions')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleOpenCreateModal = () => {
    setEditingRole(null)
    setFormName('')
    setFormDescription('')
    setSelectedPermissionIds([])
    setIsModalOpen(true)
  }

  const handleOpenEditModal = (role: Role) => {
    setEditingRole(role)
    setFormName(role.name)
    setFormDescription(role.description || '')
    setSelectedPermissionIds([...role.permission_ids])
    setIsModalOpen(true)
  }

  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formName.trim()) {
      toast.error('Role name is required')
      return
    }

    setSaving(true)
    try {
      const payload = {
        name: formName.trim(),
        description: formDescription.trim(),
        permission_ids: selectedPermissionIds
      }

      if (editingRole) {
        await api.put(`/roles/${editingRole.id}`, payload)
        toast.success(`Role "${formName}" updated successfully`)
      } else {
        await api.post('/roles', payload)
        toast.success(`Role "${formName}" created successfully`)
      }

      setIsModalOpen(false)
      loadData()
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to save role')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteRole = async (role: Role) => {
    if (!window.confirm(`Are you sure you want to delete the role "${role.name}"?`)) return

    try {
      await api.delete(`/roles/${role.id}`)
      toast.success(`Role "${role.name}" deleted`)
      setRoles(prev => prev.filter(r => r.id !== role.id))
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to delete role')
    }
  }

  const togglePermission = (id: number) => {
    setSelectedPermissionIds(prev =>
      prev.includes(id) ? prev.filter(pId => pId !== id) : [...prev, id]
    )
  }

  // Group permissions by category (e.g. "students", "staff", "attendance")
  const groupedPermissions = permissions.reduce<Record<string, Permission[]>>((acc, perm) => {
    const category = perm.code.split('.')[0] || 'general'
    if (!acc[category]) acc[category] = []
    acc[category].push(perm)
    return acc
  }, {})

  const toggleCategory = (categoryPerms: Permission[]) => {
    const catIds = categoryPerms.map(p => p.id)
    const allSelected = catIds.every(id => selectedPermissionIds.includes(id))

    if (allSelected) {
      setSelectedPermissionIds(prev => prev.filter(id => !catIds.includes(id)))
    } else {
      setSelectedPermissionIds(prev => Array.from(new Set([...prev, ...catIds])))
    }
  }

  return (
    <AdminLayout>
      <PageHeader
        title="Roles & Permissions"
        subtitle="Create, edit, and manage custom staff roles and backend permission scopes"
        actions={
          <button
            onClick={handleOpenCreateModal}
            className="btn-primary flex items-center gap-2"
          >
            <Plus size={18} /> Create New Role
          </button>
        }
      />

      {loading ? (
        <Loading />
      ) : roles.length === 0 ? (
        <Empty message="No roles defined yet" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {roles.map(role => {
            const rolePerms = permissions.filter(p => role.permission_ids.includes(p.id))
            const categories = Array.from(new Set(rolePerms.map(p => p.code.split('.')[0])))

            return (
              <div
                key={role.id}
                className="card p-6 flex flex-col justify-between hover:shadow-xl transition-all border border-gray-200 dark:border-gray-800"
              >
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                        <ShieldCheck size={20} />
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900 dark:text-white text-lg">
                          {role.name}
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {role.description || 'Custom staff role'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-gray-100 dark:border-gray-800">
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
                      <span className="font-medium">Permissions Granted</span>
                      <Badge variant="green">{role.permission_ids.length} Allowed</Badge>
                    </div>

                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {categories.length > 0 ? (
                        categories.map(cat => (
                          <span
                            key={cat}
                            className="px-2 py-0.5 rounded text-[11px] font-mono bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 capitalize"
                          >
                            {cat}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-gray-400 italic">No permissions assigned</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="pt-4 mt-6 border-t border-gray-100 dark:border-gray-800 flex items-center justify-end gap-2">
                  <button
                    onClick={() => handleOpenEditModal(role)}
                    className="btn-secondary flex items-center gap-1.5 py-1.5 px-3 text-xs"
                  >
                    <Edit3 size={14} /> Edit Role
                  </button>
                  <button
                    onClick={() => handleDeleteRole(role)}
                    className="btn-danger flex items-center gap-1.5 py-1.5 px-3 text-xs"
                  >
                    <Trash2 size={14} /> Delete
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Role Create / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="card w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800">
            {/* Modal Header */}
            <div className="p-5 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="text-emerald-500" size={22} />
                <h3 className="font-bold text-gray-900 dark:text-white text-lg">
                  {editingRole ? `Edit Role: ${editingRole.name}` : 'Create New Custom Role'}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveRole} className="p-6 overflow-y-auto space-y-6 flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Role Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Academic Supervisor"
                    className="input w-full"
                    value={formName}
                    onChange={e => setFormName(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Description
                  </label>
                  <input
                    type="text"
                    placeholder="Brief description of role responsibilities"
                    className="input w-full"
                    value={formDescription}
                    onChange={e => setFormDescription(e.target.value)}
                  />
                </div>
              </div>

              {/* Permissions Checklist Grouped by Category */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-sm text-gray-900 dark:text-white flex items-center gap-1.5">
                    <Lock size={16} className="text-emerald-500" />
                    Assign Permissions ({selectedPermissionIds.length} Selected)
                  </h4>
                  <div className="flex gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setSelectedPermissionIds(permissions.map(p => p.id))}
                      className="text-emerald-600 dark:text-emerald-400 hover:underline font-medium"
                    >
                      Select All
                    </button>
                    <span className="text-gray-300">|</span>
                    <button
                      type="button"
                      onClick={() => setSelectedPermissionIds([])}
                      className="text-gray-500 hover:underline"
                    >
                      Deselect All
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  {Object.entries(groupedPermissions).map(([category, perms]) => {
                    const catIds = perms.map(p => p.id)
                    const isAllCatSelected = catIds.every(id => selectedPermissionIds.includes(id))

                    return (
                      <div
                        key={category}
                        className="p-4 rounded-xl bg-gray-50 dark:bg-slate-800/60 border border-gray-100 dark:border-slate-800 space-y-2.5"
                      >
                        <div className="flex items-center justify-between border-b border-gray-200 dark:border-slate-700 pb-2">
                          <span className="font-bold text-xs uppercase tracking-wider text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                            <Layers size={14} /> {category} Module
                          </span>
                          <button
                            type="button"
                            onClick={() => toggleCategory(perms)}
                            className="text-[11px] text-gray-500 hover:text-emerald-600 dark:hover:text-emerald-400 font-medium"
                          >
                            {isAllCatSelected ? 'Deselect Category' : 'Select Category'}
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-1">
                          {perms.map(p => {
                            const isChecked = selectedPermissionIds.includes(p.id)
                            return (
                              <label
                                key={p.id}
                                className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer transition-all ${
                                  isChecked
                                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200'
                                    : 'bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-700 text-gray-700 dark:text-gray-300 hover:border-gray-300'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => togglePermission(p.id)}
                                  className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                                />
                                <span className="truncate font-mono" title={p.code}>
                                  {p.code}
                                </span>
                              </label>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Modal Actions */}
              <div className="pt-4 border-t border-gray-100 dark:border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-primary text-xs flex items-center gap-2"
                >
                  {saving ? 'Saving...' : editingRole ? 'Update Role' : 'Create Role'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
