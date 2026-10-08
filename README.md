# Notas compartidas

Bloc de notas web compartido que se sincroniza en tiempo real entre todas las personas que lo tengan abierto. Es una página estática (alojada en GitHub Pages) que usa Firebase Realtime Database para guardar las notas.

## Funciones

- Crear, editar, buscar y borrar notas
- Checklists: el botón **☑ Checklist** convierte las líneas en tareas con casillas que se pueden marcar (editor [Quill](https://quilljs.com))
- Sincronización casi instantánea (los cambios se envían a los 250 ms de dejar de escribir)
- Indicador de conexión y número de personas en línea
- Enlace directo a cada nota (`…/#idDeLaNota`)
- Modo oscuro automático y diseño adaptado a móvil

## Configuración de Firebase

1. Crea un proyecto en <https://console.firebase.google.com>.
2. En **Compilación → Realtime Database**, crea una base de datos.
3. En la pestaña **Reglas**, pega el contenido de [`database.rules.json`](database.rules.json) y publica.
4. En **Configuración del proyecto → Tus apps**, añade una app **Web** y copia el objeto `firebaseConfig` en [`firebase-config.js`](firebase-config.js).

> Las claves de Firebase de una app web son públicas por diseño. Lo que protege los datos son las reglas de la base de datos. Con estas reglas, cualquiera que tenga la URL puede leer y editar las notas.

## Ejecutar en local

Cualquier servidor estático vale, por ejemplo:

```sh
npx serve .
```
