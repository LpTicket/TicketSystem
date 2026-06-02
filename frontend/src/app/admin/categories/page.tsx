'use client';

import toast from 'react-hot-toast';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import {
  HiOutlinePlus, HiOutlinePencil, HiOutlineTrash,
  HiOutlineCheck, HiOutlineX, HiOutlineTag,
} from 'react-icons/hi';

interface Category {
  id: string;
  slug: string;
  labelEs: string;
  labelEn: string;
  icon: string;
  color: string;
  sortOrder: number;
  isActive: boolean;
  imageData?: string | null;
}

/** Read an image file, downscale it to keep the stored base64 small, return a data URI. */
function fileToCompressedDataUrl(file: File, maxSize = 600, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('No canvas context')); return; }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const PRESET_COLORS = [
  '#f97316', '#8b5cf6', '#ec4899', '#eab308',
  '#22c55e', '#06b6d4', '#3b82f6', '#6b7280',
  '#ef4444', '#10b981', '#f59e0b', '#6366f1',
];

const PRESET_ICONS = ['🎵','🎭','🎪','😂','⚽','🎤','🧒','🎫','🎬','🏟️','🎺','🥁','🎸','🎹','🎻','🏀','🎾','🏐','🚀','🌟'];

function slugify(text: string) {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const emptyForm = { slug: '', labelEs: '', labelEn: '', icon: '🎫', color: '#6366f1', sortOrder: 0, imageData: '' as string };
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleImagePick = async (file?: File | null) => {
    if (!file) return;
    try {
      const dataUrl = await fileToCompressedDataUrl(file);
      setForm((f) => ({ ...f, imageData: dataUrl }));
    } catch {
      toast.error('No se pudo procesar la imagen');
    }
  };

  useEffect(() => { loadCategories(); }, []);

  const loadCategories = async () => {
    try {
      const { data } = await api.get('/categories?all=true');
      setCategories(data);
    } catch { } finally { setLoading(false); }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      await api.post('/categories', form);
      setForm(emptyForm);
      setShowForm(false);
      await loadCategories();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al crear categoría');
    } finally { setSaving(false); }
  };

  const handleUpdate = async (id: string, updates: Partial<Category>) => {
    try {
      await api.patch(`/categories/${id}`, updates);
      await loadCategories();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Error');
    }
  };

  const handleDelete = async (id: string, label: string) => {
    if (!confirm(`¿Eliminar categoría "${label}"? Los eventos con esta categoría mostrarán "otro".`)) return;
    try {
      await api.delete(`/categories/${id}`);
      await loadCategories();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Error al eliminar');
    }
  };

  const startEdit = (cat: Category) => {
    setEditingId(cat.id);
    setForm({ slug: cat.slug, labelEs: cat.labelEs, labelEn: cat.labelEn, icon: cat.icon, color: cat.color, sortOrder: cat.sortOrder, imageData: cat.imageData || '' });
    setShowForm(false);
  };

  const handleSaveEdit = async (id: string) => {
    setSaving(true); setError('');
    try {
      await api.patch(`/categories/${id}`, form);
      setEditingId(null);
      await loadCategories();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error');
    } finally { setSaving(false); }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-3">
        <div className="h-8 skeleton rounded w-48" />
        {[...Array(5)].map((_, i) => <div key={i} className="h-14 skeleton rounded" />)}
      </div>
    );
  }

  return (
    <div className="premium-shell p-6 lg:p-8 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="premium-page-title font-black text-2xl">Categorías de eventos</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {categories.length} categoría{categories.length !== 1 ? 's' : ''} — los organizadores las verán al crear eventos
          </p>
        </div>
        <button
          onClick={() => { setShowForm(!showForm); setEditingId(null); setForm(emptyForm); setError(''); }}
          className="btn-primary text-sm inline-flex items-center gap-2"
        >
          <HiOutlinePlus className="w-4 h-4" />
          Nueva categoría
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <form onSubmit={handleCreate} className="rounded-xl border border-[rgba(246,198,95,0.16)] bg-[rgba(8,31,51,0.55)] p-5 space-y-4">
          <h2 className="font-bold text-gray-800 text-sm">Nueva categoría</h2>
          {error && <div className="p-2 bg-red-50 border border-red-200 rounded text-red-600 text-xs">{error}</div>}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Nombre (ES):</label>
              <input
                className="input text-sm"
                value={form.labelEs}
                onChange={(e) => setForm({ ...form, labelEs: e.target.value, slug: slugify(e.target.value) })}
                placeholder="ej. Concierto"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Name (EN):</label>
              <input
                className="input text-sm"
                value={form.labelEn}
                onChange={(e) => setForm({ ...form, labelEn: e.target.value })}
                placeholder="e.g. Concert"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Slug (auto-generado):</label>
              <input
                className="input text-sm font-mono"
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: slugify(e.target.value) })}
                placeholder="ej. concierto"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Orden:</label>
              <input
                className="input text-sm"
                type="number"
                value={form.sortOrder}
                onChange={(e) => setForm({ ...form, sortOrder: parseInt(e.target.value) || 0 })}
                min={0}
              />
            </div>
          </div>

          {/* Icon picker */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">Ícono:</label>
            <div className="flex flex-wrap gap-2">
              {PRESET_ICONS.map((ic) => (
                <button
                  key={ic} type="button"
                  onClick={() => setForm({ ...form, icon: ic })}
                  className={`w-9 h-9 text-lg rounded-lg border-2 transition-all ${form.icon === ic ? 'border-primary-500 bg-primary-50 scale-110' : 'border-gray-200 hover:border-gray-300'}`}
                >
                  {ic}
                </button>
              ))}
              <input
                className="input text-sm w-20"
                value={form.icon}
                onChange={(e) => setForm({ ...form, icon: e.target.value })}
                placeholder="🎫"
              />
            </div>
          </div>

          {/* Color picker */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">Color:</label>
            <div className="flex flex-wrap gap-2 items-center">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c} type="button"
                  onClick={() => setForm({ ...form, color: c })}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${form.color === c ? 'border-gray-900 scale-110' : 'border-transparent'}`}
                  style={{ background: c }}
                />
              ))}
              <input
                type="color"
                value={form.color}
                onChange={(e) => setForm({ ...form, color: e.target.value })}
                className="w-8 h-8 rounded cursor-pointer border border-gray-200"
                title="Color personalizado"
              />
              <span className="text-xs text-gray-500 font-mono">{form.color}</span>
            </div>
          </div>

          {/* Image upload */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">Imagen de la categoría (opcional):</label>
            <div className="flex items-center gap-3">
              {form.imageData ? (
                <div className="relative w-20 h-20 rounded-lg overflow-hidden border border-gray-200 shrink-0">
                  <img src={form.imageData} alt="preview" className="w-full h-full object-cover" />
                  <button type="button" onClick={() => setForm({ ...form, imageData: '' })}
                    className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center text-xs hover:bg-red-500">×</button>
                </div>
              ) : (
                <div className="w-20 h-20 rounded-lg border-2 border-dashed border-gray-200 flex items-center justify-center text-gray-300 text-2xl shrink-0">🖼️</div>
              )}
              <label className="btn-secondary text-xs px-4 cursor-pointer">
                {form.imageData ? 'Cambiar imagen' : 'Subir imagen'}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImagePick(e.target.files?.[0])} />
              </label>
            </div>
          </div>

          {/* Preview */}
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            <span className="text-xs text-gray-500">Vista previa:</span>
            <span
              className="section-badge"
              style={{ background: form.color }}
            >
              {form.icon} {form.labelEs || 'Nombre'}
            </span>
          </div>

          <div className="flex gap-3">
            <button type="submit" disabled={saving} className="btn-primary text-sm px-6">
              {saving ? 'Guardando...' : 'Crear categoría'}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="btn-secondary text-sm px-4">
              Cancelar
            </button>
          </div>
        </form>
      )}

      {/* Categories list */}
      <div className="rounded-xl border border-[rgba(246,198,95,0.16)] bg-[rgba(8,31,51,0.45)] overflow-hidden shadow-sm">
        {/* Desktop Table View */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Categoría</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase hidden md:table-cell">Slug</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase hidden lg:table-cell">EN</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Estado</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {categories.map((cat) => (
                <tr key={cat.id} className="hover:bg-gray-50 transition-colors">
                  {editingId === cat.id ? (
                    <td colSpan={5} className="px-5 py-6 bg-[rgba(10,55,90,0.06)]/30">
                      {error && <div className="p-2 mb-4 bg-red-50 border border-red-200 rounded text-red-600 text-xs">{error}</div>}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-gray-500 uppercase">Nombre ES</label>
                          <input className="input text-sm" value={form.labelEs} onChange={(e) => setForm({ ...form, labelEs: e.target.value })} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-gray-500 uppercase">Nombre EN</label>
                          <input className="input text-sm" value={form.labelEn} onChange={(e) => setForm({ ...form, labelEn: e.target.value })} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-gray-500 uppercase">Ícono / Color</label>
                          <div className="flex items-center gap-2">
                            <input className="input text-sm w-16" value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} />
                            <input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })}
                              className="w-10 h-10 rounded cursor-pointer border border-gray-200" />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-gray-500 uppercase">Imagen</label>
                          <div className="flex items-center gap-2">
                            {form.imageData ? (
                              <div className="relative w-10 h-10 rounded-lg overflow-hidden border border-gray-200 shrink-0">
                                <img src={form.imageData} alt="" className="w-full h-full object-cover" />
                                <button type="button" onClick={() => setForm({ ...form, imageData: '' })}
                                  className="absolute inset-0 bg-black/50 text-white text-[10px] opacity-0 hover:opacity-100">Quitar</button>
                              </div>
                            ) : (
                              <div className="w-10 h-10 rounded-lg border-2 border-dashed border-gray-200 flex items-center justify-center text-gray-300 shrink-0">🖼️</div>
                            )}
                            <label className="btn-secondary text-[11px] px-3 py-2 cursor-pointer whitespace-nowrap">
                              {form.imageData ? 'Cambiar' : 'Subir'}
                              <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImagePick(e.target.files?.[0])} />
                            </label>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => handleSaveEdit(cat.id)} disabled={saving}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[#0A375A] text-white text-xs font-bold rounded-lg hover:bg-[#0A375A] transition-colors shadow-sm">
                            <HiOutlineCheck className="w-4 h-4" /> {saving ? '...' : 'Guardar'}
                          </button>
                          <button onClick={() => setEditingId(null)}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-600 text-xs font-bold rounded-lg hover:bg-gray-50 transition-colors">
                            <HiOutlineX className="w-4 h-4" /> Cancelar
                          </button>
                        </div>
                      </div>
                    </td>
                  ) : (
                    <>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-4">
                          <span
                            className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 shadow-sm"
                            style={{ background: `${cat.color}15`, border: `1.5px solid ${cat.color}30` }}
                          >
                            {cat.icon}
                          </span>
                          <div>
                            <p className="font-bold text-gray-900 text-sm leading-none mb-1.5">{cat.labelEs}</p>
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider text-white" style={{ background: cat.color }}>
                              {cat.slug}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 hidden md:table-cell">
                        <code className="text-[11px] bg-gray-100 px-2 py-1 rounded font-mono text-gray-500">{cat.slug}</code>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-500 hidden lg:table-cell">{cat.labelEn}</td>
                      <td className="px-4 py-4 text-center">
                        <button
                          onClick={() => handleUpdate(cat.id, { isActive: !cat.isActive })}
                          className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-tight transition-all ${
                            cat.isActive ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                          }`}
                        >
                          {cat.isActive ? 'Activa' : 'Inactiva'}
                        </button>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => startEdit(cat)}
                            className="p-2 rounded-lg text-gray-400 hover:text-[#0A375A] hover:bg-[rgba(10,55,90,0.06)] transition-colors"
                          >
                            <HiOutlinePencil className="w-4.5 h-4.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(cat.id, cat.labelEs)}
                            className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                          >
                            <HiOutlineTrash className="w-4.5 h-4.5" />
                          </button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="sm:hidden divide-y divide-gray-100">
          {categories.map((cat) => (
            <div key={cat.id} className="p-4 space-y-4">
              {editingId === cat.id ? (
                <div className="space-y-4">
                  <div className="space-y-3">
                    <input className="input text-sm" placeholder="Nombre ES" value={form.labelEs} onChange={(e) => setForm({ ...form, labelEs: e.target.value })} />
                    <input className="input text-sm" placeholder="Nombre EN" value={form.labelEn} onChange={(e) => setForm({ ...form, labelEn: e.target.value })} />
                    <div className="flex gap-2">
                      <input className="input text-sm w-full" value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} />
                      <input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })}
                        className="w-12 h-10 rounded cursor-pointer border border-gray-200 shrink-0" />
                    </div>
                    <div className="flex items-center gap-3">
                      {form.imageData ? (
                        <div className="relative w-14 h-14 rounded-lg overflow-hidden border border-gray-200 shrink-0">
                          <img src={form.imageData} alt="" className="w-full h-full object-cover" />
                          <button type="button" onClick={() => setForm({ ...form, imageData: '' })}
                            className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center text-xs">×</button>
                        </div>
                      ) : (
                        <div className="w-14 h-14 rounded-lg border-2 border-dashed border-gray-200 flex items-center justify-center text-gray-300 text-xl shrink-0">🖼️</div>
                      )}
                      <label className="btn-secondary text-xs px-4 cursor-pointer">
                        {form.imageData ? 'Cambiar imagen' : 'Subir imagen'}
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImagePick(e.target.files?.[0])} />
                      </label>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleSaveEdit(cat.id)} disabled={saving} className="flex-1 btn-primary text-xs py-2.5">
                      {saving ? '...' : 'Guardar'}
                    </button>
                    <button onClick={() => setEditingId(null)} className="flex-1 btn-secondary text-xs py-2.5">
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span
                      className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0"
                      style={{ background: `${cat.color}15`, border: `1.5px solid ${cat.color}30` }}
                    >
                      {cat.icon}
                    </span>
                    <div>
                      <h3 className="font-bold text-gray-900 text-sm leading-tight">{cat.labelEs}</h3>
                      <p className="text-[10px] text-gray-400 font-mono mt-1 uppercase tracking-wider">{cat.slug}</p>
                      <button
                        onClick={() => handleUpdate(cat.id, { isActive: !cat.isActive })}
                        className={`mt-2 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                          cat.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'
                        }`}
                      >
                        {cat.isActive ? 'Activa' : 'Inactiva'}
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <button onClick={() => startEdit(cat)} className="p-2 text-gray-400 hover:text-[#0A375A]">
                      <HiOutlinePencil className="w-5 h-5" />
                    </button>
                    <button onClick={() => handleDelete(cat.id, cat.labelEs)} className="p-2 text-gray-400 hover:text-red-500">
                      <HiOutlineTrash className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {categories.length === 0 && (
          <div className="px-6 py-16 text-center">
            <HiOutlineTag className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No hay categorías creadas aún</p>
          </div>
        )}
      </div>

      <div className="bg-[rgba(10,55,90,0.06)] border border-[rgba(10,55,90,0.18)] rounded-lg p-4 text-sm text-[#0A375A]">
        <strong>💡 Tip:</strong> Las categorías activas aparecen en el menú del sitio y en el formulario de creación de eventos.
        El <strong>slug</strong> es el identificador interno (ej: <code className="bg-[rgba(10,55,90,0.10)] px-1 rounded">concierto</code>).
      </div>
    </div>
  );
}
