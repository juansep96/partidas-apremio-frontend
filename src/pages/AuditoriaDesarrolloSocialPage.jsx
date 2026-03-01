import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AppLayout from '../components/AppLayout';
import SelectSearchable from '../components/SelectSearchable';
import { dsApi } from '../api/client';
import { sileo } from 'sileo';
import './AuditoriaPage.css';

const DESARROLLO_SOCIAL_ROUTE = '/desarrollo-social';
const DESARROLLO_SOCIAL_MODULE_ROUTE = '/desarrollo-social/encuestas';

export default function AuditoriaDesarrolloSocialPage() {
  const { user, systems } = useAuth();
  const navigate = useNavigate();
  const [logs, setLogs] = useState([]);
  const [meta, setMeta] = useState(null);
  const [filters, setFilters] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detailLog, setDetailLog] = useState(null);
  const [page, setPage] = useState(1);
  const [filterAction, setFilterAction] = useState('');
  const [filterEntityType, setFilterEntityType] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [deleting, setDeleting] = useState(null);

  const desarrolloSocialSystem = systems?.find((s) => s.modules?.some((m) => m.route === DESARROLLO_SOCIAL_MODULE_ROUTE));
  const isDsAdmin = user?.globalRole === 'SUPERADMIN' || desarrolloSocialSystem?.role === 'ADMIN';

  const loadLogs = useCallback(async () => {
    if (!isDsAdmin) return;
    setLoading(true);
    try {
      const params = { page, per_page: 20 };
      if (filterAction) params.action = filterAction;
      if (filterEntityType) params.entity_type = filterEntityType;
      if (filterDateFrom) params.date_from = filterDateFrom;
      if (filterDateTo) params.date_to = filterDateTo;
      const res = await dsApi.audit.list(params);
      setLogs(res.data || []);
      setMeta(res.meta || { current_page: 1, last_page: 1, total: 0 });
      setFilters(res.filters || null);
    } catch (err) {
      sileo.error({ title: 'Error al cargar auditoría', description: err.message });
    } finally {
      setLoading(false);
    }
  }, [isDsAdmin, page, filterAction, filterEntityType, filterDateFrom, filterDateTo]);

  useEffect(() => {
    if (!user) return;
    if (!isDsAdmin) {
      navigate(DESARROLLO_SOCIAL_ROUTE, { replace: true });
      return;
    }
    loadLogs();
  }, [user, isDsAdmin, navigate, loadLogs]);

  const applyFilters = () => {
    setPage(1);
    loadLogs();
  };

  const clearFilters = () => {
    setFilterAction('');
    setFilterEntityType('');
    setFilterDateFrom('');
    setFilterDateTo('');
    setPage(1);
  };

  const openDetail = async (log) => {
    try {
      const full = await dsApi.audit.get(log.id);
      setDetailLog(full);
    } catch (err) {
      sileo.error({ title: 'Error', description: err.message });
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este registro de auditoría?')) return;
    setDeleting(id);
    try {
      await dsApi.audit.delete(id);
      sileo.success({ title: 'Registro eliminado' });
      setDetailLog(null);
      loadLogs();
    } catch (err) {
      sileo.error({ title: 'Error', description: err.message });
    } finally {
      setDeleting(null);
    }
  };

  const formatDate = (str) => {
    if (!str) return '-';
    const d = new Date(str);
    return d.toLocaleString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const userName = (u) => (u ? `${u.lastName || ''}, ${u.firstName || ''}`.replace(/^, |, $/g, '').trim() || u.dni || '-' : '-');

  if (!user || !isDsAdmin) return null;

  return (
    <AppLayout>
      <div className="auditoria-page">
        <header className="auditoria-header">
          <h1>Auditoría</h1>
          <p>Historial de acciones realizadas en el módulo Desarrollo Social</p>
        </header>

        <section className="auditoria-filters">
          <div className="auditoria-filters-row">
            <SelectSearchable
              className="auditoria-filter-select"
              options={[
                { value: '', label: 'Todas las acciones' },
                ...(filters?.actions ? Object.entries(filters.actions) : [
                  ['auth.login', 'Login'],
                  ['user.create', 'Usuario creado'],
                  ['user.update', 'Usuario actualizado'],
                  ['user.delete', 'Usuario eliminado'],
                  ['empleados.import', 'Importación empleados'],
                ]).map(([k, v]) => ({ value: k, label: v })),
              ]}
              value={filterAction}
              onChange={setFilterAction}
              placeholder="Buscar acción..."
            />
            <SelectSearchable
              className="auditoria-filter-select"
              options={[
                { value: '', label: 'Todas las entidades' },
                ...(filters?.entity_types ? Object.entries(filters.entity_types) : [
                  ['user', 'Usuario'],
                  ['empleado', 'Empleado municipal'],
                ]).map(([k, v]) => ({ value: k, label: v })),
              ]}
              value={filterEntityType}
              onChange={setFilterEntityType}
              placeholder="Buscar entidad..."
            />
            <input
              type="date"
              value={filterDateFrom}
              onChange={(e) => setFilterDateFrom(e.target.value)}
              className="auditoria-filter-input"
              placeholder="Desde"
            />
            <input
              type="date"
              value={filterDateTo}
              onChange={(e) => setFilterDateTo(e.target.value)}
              className="auditoria-filter-input"
              placeholder="Hasta"
            />
            <button type="button" className="auditoria-btn auditoria-btn-primary" onClick={applyFilters}>
              Filtrar
            </button>
            <button type="button" className="auditoria-btn auditoria-btn-secondary" onClick={clearFilters}>
              Limpiar
            </button>
          </div>
        </section>

        <section className="auditoria-table-wrap">
          {loading ? (
            <div className="auditoria-loading">Cargando...</div>
          ) : logs.length === 0 ? (
            <div className="auditoria-empty">No hay registros de auditoría</div>
          ) : (
            <table className="auditoria-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Acción</th>
                  <th>Usuario</th>
                  <th>Entidad</th>
                  <th>IP</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} onClick={() => openDetail(log)} className="auditoria-row-click">
                    <td>{formatDate(log.createdAt)}</td>
                    <td>
                      <span className={`auditoria-badge auditoria-badge-${log.action?.replace('.', '-')}`}>
                        {log.actionLabel || log.action}
                      </span>
                    </td>
                    <td>{userName(log.user)}</td>
                    <td>{log.entityTypeLabel || log.entityType || '-'}</td>
                    <td>{log.ipAddress || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {meta && meta.last_page > 1 && (
          <div className="auditoria-pagination">
            <button
              type="button"
              className="auditoria-btn auditoria-btn-secondary"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Anterior
            </button>
            <span className="auditoria-pagination-info">
              Página {meta.current_page} de {meta.last_page} ({meta.total} registros)
            </span>
            <button
              type="button"
              className="auditoria-btn auditoria-btn-secondary"
              disabled={page >= meta.last_page}
              onClick={() => setPage((p) => p + 1)}
            >
              Siguiente
            </button>
          </div>
        )}

        {detailLog && (
          <div className="auditoria-modal-overlay" onClick={() => setDetailLog(null)}>
            <div className="auditoria-modal" onClick={(e) => e.stopPropagation()}>
              <div className="auditoria-modal-header">
                <h2>Detalle de auditoría</h2>
                <button type="button" className="auditoria-modal-close" onClick={() => setDetailLog(null)} aria-label="Cerrar">
                  ×
                </button>
              </div>
              <div className="auditoria-modal-body">
                <dl className="auditoria-detail-list">
                  <div>
                    <dt>Fecha</dt>
                    <dd>{formatDate(detailLog.createdAt)}</dd>
                  </div>
                  <div>
                    <dt>Acción</dt>
                    <dd>{detailLog.actionLabel || detailLog.action}</dd>
                  </div>
                  <div>
                    <dt>Usuario</dt>
                    <dd>{userName(detailLog.user)} {detailLog.user?.dni && `(DNI ${detailLog.user.dni})`}</dd>
                  </div>
                  <div>
                    <dt>Entidad</dt>
                    <dd>{detailLog.entityTypeLabel || detailLog.entityType || '-'} {detailLog.entityId && `#${detailLog.entityId}`}</dd>
                  </div>
                  <div>
                    <dt>IP</dt>
                    <dd>{detailLog.ipAddress || '-'}</dd>
                  </div>
                  {detailLog.oldData && Object.keys(detailLog.oldData).length > 0 && (
                    <div>
                      <dt>Datos anteriores</dt>
                      <dd><pre className="auditoria-json">{JSON.stringify(detailLog.oldData, null, 2)}</pre></dd>
                    </div>
                  )}
                  {detailLog.newData && Object.keys(detailLog.newData).length > 0 && (
                    <div>
                      <dt>Datos nuevos</dt>
                      <dd><pre className="auditoria-json">{JSON.stringify(detailLog.newData, null, 2)}</pre></dd>
                    </div>
                  )}
                </dl>
              </div>
              <div className="auditoria-modal-footer">
                <button
                  type="button"
                  className="auditoria-btn auditoria-btn-danger"
                  onClick={() => handleDelete(detailLog.id)}
                  disabled={deleting === detailLog.id}
                >
                  {deleting === detailLog.id ? 'Eliminando...' : 'Eliminar registro'}
                </button>
                <button type="button" className="auditoria-btn auditoria-btn-secondary" onClick={() => setDetailLog(null)}>
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
