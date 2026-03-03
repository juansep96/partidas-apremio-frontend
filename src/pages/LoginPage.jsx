import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { sileo } from 'sileo';
import { authApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import './LoginPage.css';

const LOGO_URL = '/logo.png';

// Imágenes de Monte Hermoso, Buenos Aires, Argentina (reemplazables por fotos oficiales)
const MONTE_HERMOSO_IMAGES = [
  'https://dynamic-media-cdn.tripadvisor.com/media/photo-o/11/e2/23/1c/img-20171231-201032060.jpg', // playa
  'https://dynamic-media-cdn.tripadvisor.com/media/photo-o/0f/9a/a5/c5/monte-hermoso.jpg', // playa atardecer
  'https://montehermoso.gov.ar/sitio/wp-content/uploads/Atractivos-Playa03.jpg',   // costa
  'https://www.noticiasmontehermoso.com.ar/wp-content/uploads/2021/01/Monte-Hermoso-playa-vista-aerea.jpg',   // playa argentina
  'https://elviajeroaccidental.com/wp-content/uploads/2020/09/Portada-1-scaled.jpg', // mar
  'https://redcabanias.com/wp-content/uploads/2025/10/playa-monte-hermoso.jpg', // costa rocosa
];

export default function LoginPage() {
  const [step, setStep] = useState(1);
  const [dni, setDni] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [slideIndex, setSlideIndex] = useState(0);
  const { login } = useAuth();
  const navigate = useNavigate();

  const shuffledImages = useMemo(
    () => [...MONTE_HERMOSO_IMAGES].sort(() => Math.random() - 0.5),
    []
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setSlideIndex((i) => (i + 1) % shuffledImages.length);
    }, 4500);
    return () => clearInterval(interval);
  }, [shuffledImages.length]);

  const handleRequestOtp = async (e) => {
    e.preventDefault();
    const dniClean = dni.replace(/\D/g, '');
    setLoading(true);

    // UI optimista: mostramos el paso del código de inmediato para no bloquear esperando el envío del email
    const req = authApi.requestOtp(dniClean);
    setStep(2);
    setLoading(false);

    try {
      const res = await req;
      if (res.success) {
        if (res.debug_code) setCode(res.debug_code);
        sileo.info({
          title: 'Código enviado',
          description: 'Revisá tu email o teléfono para el código de verificación.',
        });
      } else {
        setStep(1);
        sileo.error({
          title: 'Error',
          description: res.message || 'No se pudo enviar el código.',
        });
      }
    } catch (err) {
      setStep(1);
      sileo.error({
        title: 'Error de conexión',
        description: err.message || 'Intentá de nuevo más tarde.',
      });
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await authApi.verifyOtp(dni.replace(/\D/g, ''), code);
      if (res.success) {
        login(res);
        sileo.success({ title: '¡Bienvenido!' });
        const syss = res.systems || [];
        if (syss.length === 1 && syss[0].modules?.length === 1) {
          navigate(syss[0].modules[0].route);
        } else if (syss.length === 1 && syss[0].modules?.length > 1) {
          navigate(`/sistema/${syss[0].id}`);
        } else {
          navigate('/sistemas');
        }
      } else {
        sileo.error({
          title: 'Código inválido',
          description: res.message || 'Ingresá el código correcto o solicitá uno nuevo.',
        });
      }
    } catch (err) {
      sileo.error({
        title: 'Error al verificar',
        description: err.message || 'Intentá de nuevo.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-bg-slideshow" aria-hidden="true">
        {shuffledImages.map((src, i) => (
          <img
            key={src}
            src={src}
            alt={`Monte Hermoso ${i + 1}`}
            className={`login-slide ${i === slideIndex ? 'active' : ''}`}
          />
        ))}
      </div>
      <div className="login-bg-overlay" aria-hidden="true" />
      <div className="login-card">
        <div className="login-brand-panel">
          <div className="login-brand-header">
            <img src={LOGO_URL} alt="Municipalidad de Monte Hermoso" className="login-logo" />
            <div className="login-brand-titles">
              <h1>Municipalidad de Monte Hermoso</h1>
            </div>
          </div>
          <div className="login-brand-copy">
            <h2>Secretaría de Desarrollo Humano y Social</h2>
            <h3>Subsecretaría de Desarrollo Humano y Social</h3>
            <h3>Subsecretaría de Desarrollo Humano, Mujer, Género y Diversidades</h3>
          </div>
          <div className="login-brand-footer">© {new Date().getFullYear()} Municipalidad de Monte Hermoso · Uso interno</div>
        </div>

        <div className="login-form-wrapper">
          <div className="login-form-inner">
            <div className="login-mobile-brand">
              <img src={LOGO_URL} alt="Municipalidad de Monte Hermoso" className="login-logo-mobile" />
              <span>Municipalidad de Monte Hermoso</span>
            </div>

            <h2 className="login-form-title">Iniciar sesión</h2>

            {step === 1 ? (
            <form onSubmit={handleRequestOtp} className="login-form">
              <label className="login-field-label">DNI</label>
              <input
                type="tel"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="off"
                placeholder="Ingrese su DNI ej: 12345678"
                value={dni}
                onChange={(e) => setDni(e.target.value.replace(/\D/g, '').slice(0, 8))}
                maxLength={8}
                required
                autoFocus
              />
              <button type="submit" disabled={loading || dni.length < 7}>
                {loading ? 'Enviando...' : 'Iniciar sesión'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="login-form">
              <p className="otp-hint">Enviamos un código de 6 dígitos a tu email/teléfono. Puede tardar unos segundos en llegar.</p>
              <label className="login-field-label">Código recibido</label>
              <input
                type="tel"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="one-time-code"
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                maxLength={6}
                required
                autoFocus
              />
              <button type="submit" disabled={loading || code.length !== 6}>
                {loading ? 'Verificando...' : 'Ingresar'}
              </button>
              <button type="button" className="link-btn" onClick={() => { setStep(1); setCode(''); }}>
                Volver
              </button>
            </form>
          )}

            <p className="login-footer">Si no tenés acceso, contactá a la Dirección de Cómputos.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
