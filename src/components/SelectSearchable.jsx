import React from 'react';
import Select from 'react-select';
import './SelectSearchable.css';

/**
 * Select con buscador/filtrado (estilo Select2) basado en react-select.
 * Reemplaza los selects nativos para tener búsqueda en todos los desplegables.
 *
 * @param {Object} props
 * @param {Array<{value: string|number, label: string}>|string[]} props.options - Opciones. Si son strings, se usan como value y label.
 * @param {string|number} props.value - Valor actual
 * @param {function} props.onChange - (value) => void
 * @param {string} [props.placeholder='Buscar o seleccionar...'] - Placeholder
 * @param {boolean} [props.required=false]
 * @param {boolean} [props.isClearable=true] - Permitir limpiar (default true si !required)
 * @param {boolean} [props.isDisabled=false]
 * @param {string} [props.className]
 * @param {string} [props.classNamePrefix='select-searchable']
 */
export default function SelectSearchable({
  options = [],
  value,
  onChange,
  placeholder = 'Buscar o seleccionar...',
  required = false,
  isClearable,
  isDisabled = false,
  className = '',
  classNamePrefix = 'select-searchable',
  ...rest
}) {
  const opts = options.map((o) =>
    typeof o === 'object' && o !== null && 'value' in o
      ? { value: o.value, label: o.label }
      : { value: String(o), label: String(o) }
  );

  const selectedOption = opts.find((o) => String(o.value) === String(value)) || null;

  const handleChange = (opt) => {
    const val = opt?.value ?? (required ? value : '');
    onChange(val);
  };

  return (
    <Select
      options={opts}
      value={selectedOption}
      onChange={handleChange}
      isSearchable
      isClearable={isClearable ?? !required}
      isDisabled={isDisabled}
      placeholder={placeholder}
      noOptionsMessage={() => 'Sin resultados'}
      loadingMessage={() => 'Cargando...'}
      className={`select-searchable-wrapper ${className}`.trim()}
      classNamePrefix={classNamePrefix}
      {...rest}
    />
  );
}
