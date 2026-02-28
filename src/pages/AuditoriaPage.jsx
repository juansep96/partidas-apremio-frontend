import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AppLayout from '../components/AppLayout';
import { auditApi } from '../api/client';
import { sileo } from 'sileo';
import './AuditoriaPage.css';

export default function AuditoriaPage() {
  const { user } = useAuth();
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

  const loadLogs = useCallback(async () => {
    if (!user || user.globalRole !== 'SUPERADMIN') return;
    setLoading(true);
    try {
      const params = { page, per_page: 20 };
      if (filterAction) params.action = filterAction;
      if (filterEntityType) params.entity_type = filterEntityType;
      if (filterDateFrom) params.date_from = filterDateFrom;
      if (filterDateTo) params.date_to = filterDateTo;
      const res = await auditApi.list(params);
      setLogs(res.data || []);
      setMeta(res.meta || { current_page: 1, last_page: 1, total: 0 });
      setFilters(res.filters || null);
    } catch (err) {
      sileo.error({ title: 'Error al cargar auditoría', description: err.message });
    } finally {
      setLoading(false);
    }
  }, [user, page, filterAction, filterEntityType, filterDateFrom, filterDateTo]);

  useEffect(() => {
    if (!user) return;
    if (user.globalRole !== 'SUPERADMIN') {
      navigate('/sistemas', { replace: true });
      return;
    }
    loadLogs();
  }, [user, navigate, loadLogs]);

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
      const full = await auditApi.get(log.id);
      setDetailLog(full);
    } catch (err) {
      sileo.error({ title: 'Error', description: err.message });
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este registro de auditoría?')) return;
    setDeleting(id);
    try {
      await auditApi.delete(id);
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

  if (!user || user.globalRole !== 'SUPERADMIN') return null;

  return (
    <AppLayout>
      <div className="auditoria-page">
        <header className="auditoria-header">
          <h1>Auditoría</h1>
          <p>Historial de acciones realizadas en el sistema</p>
        </header>

        <section className="auditoria-filters">
          <div className="auditoria-filters-row">
            <select
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
              className="auditoria-filter-select"
            >
              <option value="">Todas las acciones</option>
              {(filters?.actions ? Object.entries(filters.actions) : [
                ['auth.login', 'Login'],
                ['user.create', 'Usuario creado'],
                ['user.update', 'Usuario actualizado'],
                ['user.delete', 'Usuario eliminado'],
                ['empleados.import', 'Importación empleados'],
              ]).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <select
              value={filterEntityType}
              onChange={(e) => setFilterEntityType(e.target.value)}
              className="auditoria-filter-select"
            >
              <option value="">Todas las entidades</option>
              {(filters?.entity_types ? Object.entries(filters.entity_types) : [
                ['user', 'Usuario'],
                ['empleado', 'Empleado municipal'],
              ]).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
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
