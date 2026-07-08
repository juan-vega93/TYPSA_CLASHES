# Datos de Navisworks

Coloca aquí tus reportes XML exportados desde Navisworks (Clash Detective).

- Cualquier archivo `*.xml` dentro de esta carpeta se carga automáticamente
  al iniciar la aplicación (Vite lo hace vía `import.meta.glob`).
- Al hacer commit y push a GitHub, tus archivos viajan con el proyecto y el
  dashboard se actualiza en cada build/deploy.
- Convención de nombre sugerida: `PROYECTO_DISCIPLINA-DISCIPLINA.xml`
  (por ejemplo `P1_EST-ACI.xml`).

Los cambios manuales (estado, asignado, notas) se guardan en el navegador
(`localStorage`) — no dependen de los XML.

### Añadir XML sin recompilar

El botón **"Cargar más"** de la cabecera permite adjuntar XML adicionales
en caliente (solo mientras dura la sesión del navegador).
