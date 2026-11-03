"use client";

import { useState, useEffect } from 'react';
import { FaChevronDown, FaCamera } from 'react-icons/fa';
import { api, ApiError, actualizarUsuario } from '@/lib/api';

/* El backend manda null en los campos vacíos y los inputs no aceptan null */
const aForm = (p = {}) => ({
    nombre: p.nombre ?? '',
    apellido: p.apellido ?? '',
    email: p.email ?? '',
    fecha_nac: p.fecha_nac ?? '',
    nivel: p.nivel ?? 'principiante',
    peso: p.peso ?? '',
    estatura: p.estatura ?? '',
    posicion: p.posicion ?? '',
});

/* { campo: ["mensaje"] } -> { campo: "mensaje" } */
const primerError = (data) =>
    Object.fromEntries(
        Object.entries(data ?? {}).map(([k, v]) => [k, Array.isArray(v) ? v[0] : String(v)])
    );

export default function SeccionPersonal({
    perfilInicial,
    onPerfilActualizado,
    photoSrc,
    tieneFoto,
    subiendoFoto,
    onAbrirSelectorFoto,
    onQuitarFoto,
    showToast,
}) {
    const [personal, setPersonal] = useState(() => aForm(perfilInicial));
    const [personalSnapshot, setPersonalSnapshot] = useState(() => aForm(perfilInicial));
    const [personalErrors, setPersonalErrors] = useState({});

    useEffect(() => {
        if (!perfilInicial) return;
        const f = aForm(perfilInicial);
        setPersonal(f);
        setPersonalSnapshot(f);
    }, [perfilInicial]);

    const cambiar = (campo) => (e) => {
        setPersonal(p => ({ ...p, [campo]: e.target.value }));
        setPersonalErrors(p => ({ ...p, [campo]: '' }));
    };

    const claseInput = (campo) =>
        `field-input-1${personalErrors[campo] ? ' input-error' : ''}`;

    async function handlePersonalSubmit(e) {
        e.preventDefault();
        setPersonalErrors({});
        try {
            const datos = await api('/usuario/perfil/', {
                method: 'PUT',
                body: {
                    nombre: personal.nombre.trim(),
                    apellido: personal.apellido.trim(),
                    email: personal.email.trim(),
                    fecha_nac: personal.fecha_nac || null,
                    nivel: personal.nivel,
                    posicion: personal.posicion || null,
                    peso: personal.peso === '' ? null : personal.peso,
                    estatura: personal.estatura === '' ? null : personal.estatura,
                },
            });
            const nuevo = aForm(datos);
            setPersonal(nuevo);
            setPersonalSnapshot(nuevo);
            onPerfilActualizado(nuevo);
            actualizarUsuario({ nombre: nuevo.nombre, apellido: nuevo.apellido });
            showToast('✓ Información personal guardada.');
        } catch (err) {
            if (err instanceof ApiError && err.status === 400) {
                setPersonalErrors(primerError(err.data));
            } else {
                showToast('No se pudo guardar. Inténtalo de nuevo.', 'error');
            }
        }
    }

    function handlePersonalCancel() {
        setPersonal({ ...personalSnapshot });
        setPersonalErrors({});
        showToast('Cambios descartados.', 'info');
    }

    return (
        <section className="profile-section active" aria-labelledby="title-personal">
            <div className="section-split">
                <div className="section-form">
                    <h2 className="section-title" id="title-personal">Información personal</h2>
                    <form onSubmit={handlePersonalSubmit} noValidate>

                        <div className="field-row">
                            <div className="field-group">
                                <label className="field-label" htmlFor="nombre">Nombre</label>
                                <input className={claseInput('nombre')}
                                    type="text" id="nombre"
                                    value={personal.nombre}
                                    onChange={cambiar('nombre')}
                                    autoComplete="given-name" />
                                {personalErrors.nombre && <span className="field-error">{personalErrors.nombre}</span>}
                            </div>
                            <div className="field-group">
                                <label className="field-label" htmlFor="apellido">Apellido</label>
                                <input className={claseInput('apellido')}
                                    type="text" id="apellido"
                                    value={personal.apellido}
                                    onChange={cambiar('apellido')}
                                    autoComplete="family-name" />
                                {personalErrors.apellido && <span className="field-error">{personalErrors.apellido}</span>}
                            </div>
                        </div>

                        <div className="field-group">
                            <label className="field-label" htmlFor="email">Correo electrónico</label>
                            <input className={claseInput('email')}
                                type="email" id="email"
                                value={personal.email}
                                onChange={cambiar('email')}
                                autoComplete="email" />
                            {personalErrors.email && <span className="field-error">{personalErrors.email}</span>}
                        </div>

                        <div className="field-row">
                            <div className="field-group">
                                <label className="field-label" htmlFor="fechaNac">Fecha de nacimiento</label>
                                <input className={claseInput('fecha_nac')} type="date" id="fechaNac"
                                    value={personal.fecha_nac}
                                    onChange={cambiar('fecha_nac')} />
                                {personalErrors.fecha_nac && <span className="field-error">{personalErrors.fecha_nac}</span>}
                            </div>
                            <div className="field-group">
                                <label className="field-label" htmlFor="nivel">Nivel</label>
                                <div className="select-wrap">
                                    <select className="field-select" id="nivel"
                                        value={personal.nivel}
                                        onChange={cambiar('nivel')}>
                                        <option value="principiante">Principiante</option>
                                        <option value="intermedio">Intermedio</option>
                                        <option value="avanzado">Avanzado</option>
                                        <option value="profesional">Profesional</option>
                                    </select>
                                    <FaChevronDown className="fa-solid fa-chevron-down select-icon" />
                                </div>
                            </div>
                        </div>

                        <div className="field-row">
                            <div className="field-group">
                                <label className="field-label" htmlFor="peso">Peso</label>
                                <div className="input-unit-wrap">
                                    <input className={claseInput('peso')} type="number" id="peso"
                                        value={personal.peso} min="30" max="200"
                                        onChange={cambiar('peso')} />
                                    <span className="input-unit">kg</span>
                                </div>
                                {personalErrors.peso && <span className="field-error">{personalErrors.peso}</span>}
                            </div>
                            <div className="field-group">
                                <label className="field-label" htmlFor="estatura">Estatura</label>
                                <div className="input-unit-wrap">
                                    <input className={claseInput('estatura')} type="number" id="estatura"
                                        value={personal.estatura} step="0.01" min="1" max="2.5"
                                        onChange={cambiar('estatura')} />
                                    <span className="input-unit">m</span>
                                </div>
                                {personalErrors.estatura && <span className="field-error">{personalErrors.estatura}</span>}
                            </div>
                        </div>

                        <div className="field-group">
                            <label className="field-label" htmlFor="posicion">Posición</label>
                            <div className="select-wrap">
                                <select className="field-select" id="posicion"
                                    value={personal.posicion}
                                    onChange={cambiar('posicion')}>
                                    <option value="">Sin definir</option>
                                    <option value="opuesto">Opuesto</option>
                                    <option value="armador">Armador</option>
                                    <option value="central">Central</option>
                                    <option value="punta">Punta receptor</option>
                                    <option value="libero">Líbero</option>
                                </select>
                                <FaChevronDown className="fa-solid fa-chevron-down select-icon" />
                            </div>
                        </div>

                        <div className="form-actions">
                            <button className="btn btn--secondary" type="button" onClick={handlePersonalCancel}>Cancelar</button>
                            <button className="btn btn--primary" type="submit">Guardar cambios</button>
                        </div>
                    </form>
                </div>

                {/* Foto de perfil */}
                <aside className="section-photo">
                    <p className="section-photo__label">Foto de perfil</p>
                    <div className="photo-preview">
                        <img src={photoSrc} alt="Foto de perfil" className="photo-preview__img" />
                    </div>
                    <button className="btn btn--primary btn--sm" type="button"
                        disabled={subiendoFoto}
                        onClick={onAbrirSelectorFoto}>
                        <FaCamera className="fa-solid" /> {subiendoFoto ? 'Subiendo…' : 'Cambiar foto'}
                    </button>
                    {tieneFoto && (
                        <button className="btn btn--secondary btn--sm" type="button"
                            disabled={subiendoFoto} onClick={onQuitarFoto}>
                            Quitar foto
                        </button>
                    )}
                </aside>
            </div>
        </section>
    );
}