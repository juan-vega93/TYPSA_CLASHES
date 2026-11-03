# Control de compromisos

La pestaña separa el compromiso guardado, el inventario observado en XML y las proyecciones. Las ediciones locales de estado no reescriben los cortes históricos ni sustituyen el avance real manual.

## Uso

En **Período de análisis**, elegir inicio y fin y pulsar **Generar período**. Se proponen los dos últimos cortes; **Seleccionar todos los cortes** cambia la selección sin iniciar la carga. Solo se admiten XML directamente en `src/data/AAMMDD/`, con fecha calendario válida. Carpetas auxiliares, archivos sueltos, subcarpetas anidadas y fechas inválidas se ignoran. Las carpetas se ordenan cronológicamente.

El control y Línea de tiempo comparten ese período. El primer punto es la base observada del intervalo; no se calculan entradas o cierres anteriores a su inicio. Una identidad vista por primera vez se considera nueva dentro del período, no necesariamente nueva en toda la vida del proyecto.

1. Seleccionar una línea base existente, o abrir **Crear compromiso desde un corte histórico**. Elegir tests y clases antes de guardar. La nueva base conserva los pendientes, sus identidades y los criterios; no reemplaza planes anteriores.
2. Elegir el corte de evaluación. Todos los tests, incluidos los incorporados después de la base, están seleccionados inicialmente. **Solo tests de la base** limita el inventario a esos tests.
3. Revisar compromiso original, pendiente observado y conciliación. La vista calcula y exporta totales por corte, sin generar listas individuales de clashes o movimientos. El detalle de elementos permanece en las otras pestañas.
4. Introducir cierres y entradas previstos por semana. **Guardar nueva proyección** conserva otra versión, sin cambiar la curva original. Con entradas iguales o superiores a cierres, no se propone una fecha de terminación para un inventario positivo.
5. **Abrir plan semanal** permite editar metas y avance real manual de la línea base seleccionada.
6. Exportar PDF ejecutivo, conciliación CSV y gráficos SVG. Las proyecciones tienen respaldo y restauración JSON; las líneas base usan el respaldo del plan semanal. El guardado local corresponde a este navegador y origen.

## Gráficas y reporte ejecutivo

La vista principal presenta cuatro cifras: pendientes iniciales, cierres del período, entradas y pendientes finales. El desplegable conserva solo el estado del XML y el desglose de entradas y otras salidas, omitiendo valores cero. El seguimiento del plan aparece solo al elegir uno y reúne meta, cierres de la base y avance manual. La leyenda naranja/verde del desglose permanece fuera del área desplazable de las barras.

La lectura ejecutiva utiliza barras para comparar entradas, cierres por estado XML y otras salidas. La circular reparte la carga del período (pendientes iniciales + entradas) entre cierres XML, pendientes finales y otras salidas. Estos sectores no se superponen; inicio y entradas se muestran como contexto, no como sectores que se sumarían otra vez. Sus porcentajes usan la carga del período. No incluye como avance cierres anteriores al intervalo.

Se eliminó el porcentaje cierres/entradas para evitar confundirlo con avance del proyecto. Una sola banda resume el cambio neto, sus componentes y el porcentaje de aumento o disminución respecto al pendiente inicial. El circular conserva porcentajes sobre la carga del período, indicando el denominador. El cumplimiento manual del plan se compara con la meta de la misma fecha y base.

El PDF ejecutivo incluye las gráficas resumen, el balance y las curvas, con texto breve, en dos páginas. El anexo de conciliación y alcance es opcional y está desactivado inicialmente. Las notas de interpretación se pueden desplegar en la vista.

## Conciliación

Se compara cada resultado por **test + GUID**, manteniendo el último estado XML conocido. Los intervalos corresponden a los cortes disponibles; no se inventan observaciones semanales intermedias.

`Pendiente final = pendiente inicial + nuevos + reabiertos + reaparecidos + cobertura incorporada + ingresos por reclasificación/filtro - cierres XML - no localizados - cobertura retirada - salidas por reclasificación/filtro`.

- **Nuevos:** pendientes con una identidad nunca vista, en un test presente en ambos cortes. No prueba por sí solo un cambio de diseño.
- **Reabiertos:** pendientes cuyo estado anterior conocido era resuelto o aprobado.
- **Reaparecidos:** vuelven tras una ausencia y su último estado conocido era pendiente.
- **Cierres XML:** pendientes presentes en el corte anterior que ahora figuran resueltos o aprobados. No acredita validación física adicional.
- **No localizados:** un pendiente desaparece mientras su test sigue presente. No se cuenta como resuelto.
- **Cobertura incorporada/retirada:** el test aparece o desaparece del corte. No se atribuye automáticamente a producción o diseño. Los tests sin resultados no pueden distinguirse de los ausentes usando solo las filas cargadas.
- **Reclasificación/filtro:** el resultado sigue pendiente pero entra o sale de las clases o criterios seleccionados.

La serie de Línea de tiempo muestra estados presentes en cada corte, sin restar ausencias como si fueran resoluciones. Si cambia la forma de agrupar tests o se regeneran GUID, las entradas/ausencias necesitan conciliación adicional; no se fusionan por parecido de nombres.

## Alcance y límites

Los históricos usan registros sin bolsas de propiedades originales y cálculos agregados. El corte actual, ya disponible para otras pestañas, se reutiliza sin duplicarlo; los cortes solicitados se cachean durante la sesión. Los XML se descargan como archivos, no como grandes módulos JavaScript.

El compromiso conserva sus metas y avance manual. El inventario puede incluir nuevas interferencias y tests; no necesariamente coincide con el denominador de la base. Si los pendientes seleccionados del corte inicial no coinciden con la base, se omite la línea de pendiente planeado en la gráfica de inventario para evitar una comparación engañosa.

Las reglas C1-C4 provienen de la base seleccionada; sin base se usan las actuales. Los filtros generales guardados con la base se aplican al inventario; una selección puntual de GUID o par de categorías permanece identificada en el compromiso y no se extrapola a nuevas detecciones. Los controles generales de otras pestañas no cambian silenciosamente el reporte.

Las bases nuevas guardan test + GUID. Las anteriores se vinculan por GUID dentro del corte original solo cuando la correspondencia es inequívoca; los resultados sin vincular se muestran separados.

La proyección usa capacidad neta = cierres previstos - entradas previstas. Se guarda con el corte, el pendiente y la definición del alcance; solo se aplica al mismo contexto. El horizonte gráfico se limita a 104 semanas y la interfaz indica si la fecha estimada queda fuera. Los escenarios son supuestos explícitos, no fechas garantizadas ni nuevas líneas base.

## Desglose por especialidad y lectura para la curva S

En Plan de resolución se puede generar el período histórico y elegir «Corte que será la línea base». La lista usa los cortes cargados, y la selección toma los pendientes de esa fecha y actualiza el inicio. Elegir una fecha no modifica planes existentes: se crea y guarda otra base con el alcance elegido. Las selecciones puntuales de la matriz solo se aplican al corte actual.

El panel «Curva original y carga actualizada» muestra curvas acumuladas: plan original gris, referencia ajustada naranja y avance verde según la fuente elegida: manual de la base o cierres XML acumulados. La naranja sigue la forma del plan original y se desplaza verticalmente en cada corte por entradas menos otras salidas; al último control semanal del plan termina en base + entradas - otras salidas. No representa una reprogramación aprobada ni garantiza la misma fecha de cierre para la nueva carga. El mensaje inferior muestra carga actualizada - cierres = pendiente real. Los detalles de conciliación quedan desplegables. El registro manual está en la tabla que sigue a la misma gráfica; editar un acumulado selecciona la fuente manual y actualiza sus puntos. No hay una segunda gráfica. Una celda vacía no dibuja un punto y el cero es un registro explícito.

La comparación verifica que los resultados pendientes del corte original coincidan con los guardados en la base. Si falta ese corte o no coincide el alcance, muestra el motivo y no dibuja una comparación engañosa. Los nuevos planes históricos guardan también las clases elegidas. No se imputan automáticamente los cierres XML al avance manual.

El selector de especialidad incluye los tests donde participa ese código (ACI incluye EST-ACI, ACI-IME, etc.). Se combina con los checks de tests y clases, y modifica las tarjetas, balance, inventario y reporte. No vuelve a descargar XML. El compromiso y su avance manual siguen siendo los de la base original, aunque se filtre el inventario.

El gráfico por pares o tests ordena por entradas y compara con cierres XML. Cada resultado se cuenta una vez por par; no atribuye responsabilidad de diseño. Los contadores por test se generan durante la misma conciliación, sin conservar eventos individuales. El PDF incluye este desglose en páginas adicionales.

Total observado y resueltos del corte son existencias; cierres del período son transiciones. Inicio + entradas - cierres - otras salidas = pendiente final. Las otras salidas no acreditan resolución. El porcentaje de resueltos usa el total observado; el porcentaje de cierres del período usa el pendiente inicial.

Para registrar avance manual en la curva S, revisar los cierres acumulados de la base original, no sumar todos los cierres de nuevos clashes. La meta al corte es la última meta semanal con fecha menor o igual al corte; no se interpola una promesa diaria. El indicador XML frente a meta es una referencia de estados, no sustituye validación y registro manual. El aumento del alcance se presenta en el pendiente observado y su proyección versionada; la curva original conserva su línea base.

## Revisión de mantenimiento

Las cifras de las curvas se calculan desde los cortes XML, el alcance y la base guardada; no usan cantidades de ejemplo fijadas en el código. Las fechas objetivo y la forma de distribución son parámetros del plan, con valores iniciales editables. Las nuevas carpetas de src/data se incorporan al regenerar el build; una exportación estática ya publicada no descubre archivos del equipo automáticamente.

La caché compacta conserva solo los archivos del período solicitado, compartiendo el corte actual completo con las pestañas de detalle. Al volver a un período descartado puede requerirse descargar y analizar esos XML otra vez. El cálculo de la curva reutiliza la evaluación de filtros por resultado y recorre las fechas ordenadas sin búsquedas repetidas del calendario.

El lint excluye los resultados de compilación y temporales. Los errores XML se muestran en un desplegable y las fechas futuras se señalan sin modificar ni eliminar archivos. Los planes guardados permanecen en el navegador y se conservan sus respaldos JSON.

## Exportación principal del plan

La gráfica de evolución dispone de SVG, PNG y «Reporte PDF · evolución». El PDF usa la misma curva visible, resume carga original y actualizada, cierres y pendientes, y añade la conciliación por corte con paginación. El selector «Línea verde: avance mostrado» elige manual o XML; SVG, PNG y PDF usan esa elección. El PDF indica la fecha y fuente del avance, diferenciándola de la fecha del XML cuando no coinciden. La tabla de metas y avance permanece visible, con exportación CSV. El cálculo histórico se memoriza por referencia de la base y datos, por lo que editar metas, avances o cambiar la fuente de la línea verde no vuelve a conciliar los clashes.

El parser prepara los campos configurados una vez por XML y usa una consulta indexada local para cada bolsa inmutable de propiedades. Se conserva la prioridad del nombre exacto, el orden del primer alias no vacío y las equivalencias inglés/español; no se cachean globalmente propiedades de elementos.

## Gráficos complementarios en Resumen

Al final de Resumen, «Lecturas complementarias» permite mostrar u ocultar el circular con los cuatro estados XML y las barras de severidad de pendientes. Las cantidades y porcentajes se calculan sobre el alcance filtrado; estado usa el total de resultados y severidad usa el total pendiente. Cada color tiene leyenda con cantidad y porcentaje, y los filtros vacíos muestran un mensaje sin inventar resultados. Los contadores se acumulan en la misma pasada de executiveSummary.

El ranking existente admite «Prioritarios pendientes» o «Total de clashes». Este último ordena por total y separa abiertos de resueltos/aprobados; no se agrega otro ranking repetido. Zona y otros campos continúan como segmentaciones opcionales con cobertura de datos exportados.

## Metas futuras desde el corte actual

«Programar el pendiente desde el corte actual» crea versiones independientes en typsa-weekly-replans-v1. Guarda el historial de cierres XML acumulados, el corte de arranque, los pendientes y la fecha objetivo. No modifica la línea base original ni reinicia el avance en cero. El reparto uniforme inicial es opcional; cada meta futura es editable. El acumulado objetivo suma esas metas a los cierres del corte, mientras el acumulado real futuro es manual y separado. Las filas pasadas se muestran como XML de solo lectura, sin inventar metas históricas.

La curva morada se añade a la referencia naranja mientras se muestra una programación: arranca en el avance del corte y suma los compromisos futuros. La gris conserva la base original y la verde combina historial XML con el avance manual futuro, o muestra solo XML si el usuario elige esa fuente. La suma de metas debe igualar el pendiente guardado; se muestra lo que falta asignar o el exceso. Los avances futuros deben ser acumulados no decrecientes desde el ancla, hasta el total de cierres objetivo. Un borrador incompleto se conserva, pero sus exportaciones de reporte se bloquean hasta corregirlo.

Al llegar otro corte, la versión anterior conserva su referencia. El usuario puede crear otra versión desde el nuevo corte, sin borrar la anterior. Si el corte de una programación no está en el período, o su balance cambió, no se dibuja una comparación engañosa: se pide ampliar el período o generar otra versión. Las nuevas entradas futuras no se presuponen. Las programaciones se respaldan y recuperan en JSON por separado del respaldo de líneas base.

El PDF de evolución incluye la curva seleccionada y una tabla adicional de metas, objetivo acumulado, avance manual y desviación. Las metas y los cambios del avance no vuelven a conciliar los clashes históricos.

La comparación conserva cuatro líneas cuando hay programación semanal: gris original, naranja carga actualizada, morado metas futuras y verde avance real. La leyenda usa dos columnas para mostrarlas completas también en PNG y PDF.
