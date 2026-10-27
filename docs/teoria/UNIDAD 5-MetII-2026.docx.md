

**1\. Introducción**  
La calidad del software constituye un aspecto fundamental en el desarrollo de sistemas informáticos, ya que permite garantizar que los productos respondan a los requisitos establecidos, satisfagan las necesidades de los usuarios y funcionen de manera confiable. En este contexto, la verificación, la validación y las pruebas de software representan actividades esenciales para detectar defectos, reducir riesgos y mejorar la calidad durante todo el ciclo de vida del desarrollo.

El desarrollo de software es una actividad compleja que requiere planificar, diseñar, implementar, probar y mantener productos capaces de responder a necesidades concretas. Sin embargo, la implementación de funcionalidades no garantiza por sí sola que un sistema sea correcto, confiable o adecuado para su utilización.

Los errores pueden originarse en diferentes etapas del ciclo de vida: una interpretación incorrecta de los requisitos, una decisión inadecuada de diseño, un error de programación, una incompatibilidad entre componentes o una dificultad en la interacción con el usuario. Si estos defectos no se identifican oportunamente, pueden generar consecuencias económicas, operativas y de seguridad.

Por esta razón, la calidad debe abordarse como un proceso continuo y no como una actividad aislada que se realiza únicamente antes de entregar el producto. Las pruebas de software permiten obtener evidencias acerca del comportamiento del sistema, mientras que la verificación y la validación contribuyen a determinar si el producto se construye correctamente y si responde a las necesidades para las que fue desarrollado.

En la actualidad, las herramientas de automatización, los frameworks de pruebas y las prácticas de integración continua facilitan la ejecución frecuente de controles de calidad. Estas prácticas permiten detectar defectos tempranamente, reducir tareas repetitivas y proporcionar información objetiva para tomar decisiones durante el desarrollo.

**2\. Concepto de verificación y validación**  
La verificación y la validación son actividades fundamentales de la ingeniería de software. Aunque están estrechamente relacionadas, persiguen propósitos diferentes y permiten evaluar distintos aspectos de un producto.

**2.1. Verificación**  
La verificación consiste en examinar los productos de trabajo del desarrollo para determinar si cumplen las especificaciones y condiciones establecidas. Busca comprobar que el software se construye de acuerdo con los requisitos, el diseño y las reglas técnicas definidas.

Puede realizarse durante las distintas etapas del desarrollo mediante revisiones, inspecciones, análisis estático y pruebas dinámicas.

Entre las principales actividades de verificación se encuentran:

* Revisión de requisitos y documentos de diseño.  
* Inspección del código fuente.  
* Análisis estático para identificar posibles defectos sin ejecutar el programa.  
* Pruebas unitarias para comprobar funciones o componentes individuales.  
* Comprobación del cumplimiento de estándares de programación.  
* Revisión de interfaces y contratos entre componentes.

**Ejemplo:** en un sistema de gestión académica, se establece que el cálculo del importe de una cuota debe sumar el arancel básico y los conceptos adicionales. La verificación permite comprobar que el algoritmo implementado respeta la fórmula especificada y contempla las condiciones definidas.

La verificación contribuye a detectar inconsistencias antes de que se propaguen a otras partes del sistema.

**2.2. Validación**  
La validación tiene como finalidad determinar si el producto desarrollado satisface las necesidades y expectativas de sus usuarios y si resulta adecuado para el uso previsto.

No se limita a comprobar que el sistema cumpla las especificaciones documentadas, sino que también considera si esas especificaciones representan correctamente el problema que se busca resolver.

Entre las actividades de validación se incluyen:

* Pruebas de aceptación con usuarios o representantes del negocio.  
* Evaluaciones de usabilidad y accesibilidad.  
* Pruebas con escenarios reales de utilización.  
* Validación de procesos de negocio.  
* Evaluaciones de prototipos con usuarios.  
* Comprobación de que las funcionalidades resuelvan las necesidades planteadas.

**Ejemplo:** el sistema de gestión académica calcula correctamente las cuotas según las reglas implementadas. Sin embargo, los responsables administrativos necesitan generar comprobantes individuales y consultar las deudas por estudiante, funciones que no fueron contempladas en los requisitos iniciales. La validación permite detectar que, aunque el cálculo sea correcto, el sistema todavía no responde completamente a las necesidades operativas.

**2.3. Diferencias entre verificación y validación**

|  Criterio | Verificación | Validación |
| :---: | ----- | ----- |
| **Propósito** | Comprobar el cumplimiento de las especificaciones. | Comprobar la adecuación a las necesidades del usuario. |
| **Pregunta central** | ¿Estamos construyendo correctamente el producto? | ¿Estamos construyendo el producto correcto? |
| **Referencia principal** | Requisitos, diseño y estándares técnicos. | Necesidades, expectativas y contexto de uso. |
| **Actividades frecuentes** | Revisiones, inspecciones, análisis estático y pruebas de componentes. | Pruebas de aceptación, escenarios reales y evaluación con usuarios. |
| **Momento** | A lo largo de todo el desarrollo. | Durante el desarrollo y especialmente al evaluar el producto frente al uso previsto. |
| **Resultado esperado** | Evidencia de conformidad con las especificaciones. | Evidencia de que el producto resulta adecuado para su finalidad. |

Ambas actividades son complementarias. Un sistema puede superar las verificaciones técnicas y, aun así, no satisfacer las necesidades del usuario. Del mismo modo, una funcionalidad puede parecer útil, pero presentar errores técnicos que impidan su utilización confiable.

**3\. Estrategias de pruebas de software**  
Una estrategia de pruebas define cómo se planifican, diseñan, ejecutan y evalúan las pruebas para obtener evidencia suficiente sobre la calidad del software. Su selección depende de los riesgos, la complejidad del sistema, los requisitos, los recursos disponibles y las consecuencias de una posible falla.

**3.1. Pruebas estáticas y dinámicas**  
Las pruebas estáticas examinan los artefactos del software sin ejecutar el programa. Incluyen revisiones de código, inspecciones de requisitos y herramientas de análisis estático. Además, contribuyen a mejorar la calidad y la confiabilidad general del software. Asimismo, potencian la mantenibilidad del código y, a largo plazo, ahorran tiempo y dinero. 

Las **pruebas estáticas** de software son técnicas de verificación en las que se evalúa el código fuente, la documentación o los artefactos del proyecto sin ejecutar el programa. 

**Principales características**

* **Detección temprana:** Permiten encontrar errores en las fases iniciales del ciclo de vida del desarrollo (SDLC) antes de la ejecución real.   
* **Menor costo:** Es mucho más económico corregir un fallo en los requisitos o en el diseño que repararlo en producción o durante las pruebas dinámicas.   
* **Calidad interna:** Se enfocan en la estructura, la legibilidad y la adherencia a los estándares, a diferencia de las pruebas dinámicas que analizan el comportamiento en tiempo de ejecución.  
* **Cumplimiento de estándares:** Asegura que el código cumpla con las mejores prácticas y los estándares de codificación establecidos. 

**Tipos y técnicas principales**

* **Revisiones (Reviews):** Procesos manuales donde el equipo examina los documentos o el código.  
  * *Revisión informal:* Intercambio rápido de opiniones sin un proceso estricto.  
  * *Walkthrough (Tutorial):* El autor guía al resto del equipo paso a paso a través del documento o código.  
  * *Revisión por pares (Peer Review):* Compañeros evalúan el trabajo para detectar fallos.  
  * *Inspección:* Un proceso formal liderado por un moderador capacitado con listas de verificación rigurosas.   
* **Análisis estático Automático:** Examen automatizado del código fuente mediante herramientas específicas.  
  * **Herramientas comunes:** SonqarQube, ESLint, Checkstyle, PMD y soluciones de calidad de código de BrowserStack.   
* **Qué detectan:** Fallos comunes de programación como variables no utilizadas, bloques catch vacíos, código muerto (*dead code*), bucles infinitos, variables sin inicializar, errores de sintaxis y la creación innecesaria de objetos. También ayudan a identificar vulnerabilidades de seguridad.

**Artefactos que se pueden evaluar**

* Documentos de requisitos (BRD, SRS)  
* Diseños de arquitectura e interfaz  
* Código fuente y scripts de prueba  
* Casos de uso y prototipos 

**Herramientas de Análisis Estático por Lenguaje**  
Estas herramientas automatizan la revisión de tu código buscando malas prácticas, errores de sintaxis y vulnerabilidades de seguridad antes de que compiles o compiles tu programa:

**🌐 JavaScript / TypeScript**

* **ESLint:** La herramienta estándar para encontrar patrones problemáticos y asegurar que el equipo siga las mismas reglas de estilo.  
* **SonarQube / SonarCloud:** Excelente para medir la "deuda técnica", cobertura de código y duplicaciones.

**🐍 Python**

* **Pylint / Flake8:** Analizan el código en busca de errores de programación y verifican que se cumpla el estándar de estilo oficial de Python (PEP 8).  
* **Bandit:** Una herramienta enfocada específicamente en encontrar vulnerabilidades de seguridad comunes en código Python.

**☕ Java**

* **SpotBugs (sucesor de FindBugs):** Utiliza análisis estático para buscar errores comunes en el código de bytes de Java.  
* **Checkstyle:** Se asegura de que todos los desarrolladores del equipo sigan las reglas de formato preestablecidas.

**🏢 C\# / .NET**

* **Roslyn Analyzers:** Analizadores integrados directamente en Visual Studio que te alertan de problemas en tiempo real mientras escribes código

**Ventajas de las Pruebas Estáticas**

* **Ahorro de costos y tiempo:** Detectar y corregir problemas en etapas tempranas evita costosos retrabajos en fases posteriores.   
* **Mayor productividad:** Ayuda a que los errores de sintaxis y lógica se resuelvan antes de pasar a producción o fases de pruebas pesadas.   
* **Mejora en la colaboración:** Fomenta el entendimiento mutuo de los aspectos técnicos y los requerimientos del software entre los miembros del equipo. 

**Desventajas de las Pruebas Estáticas**

* **Involucramiento humano:** Los procesos manuales requieren mucho tiempo y la participación activa de diversos perfiles.   
* **Limitaciones de las herramientas:** Las herramientas automatizadas suelen estar limitadas a ciertos lenguajes de programación y pueden arrojar resultados falsos positivos o pasar por alto puntos débiles complejos. 

Mientras que las pruebas estáticas detectan problemas en las especificaciones y en el código de forma temprana, las pruebas dinámicas validan el comportamiento del software en tiempo de ejecución.

Las **pruebas dinámicas de software** son un método de verificación en el que se ejecuta el código fuente para observar el comportamiento real de la aplicación, comprobar su funcionamiento y comparar los resultados obtenidos con los esperados

Las **pruebas dinámicas** requieren ejecutar el software con determinados datos de entrada para observar su comportamiento y comparar los resultados obtenidos con los esperados.

Ambas estrategias son complementarias: el análisis estático puede detectar determinadas anomalías antes de ejecutar el sistema, mientras que las pruebas dinámicas permiten comprobar su comportamiento efectivo.

**Características principales**

* **Ejecución de código:** Requieren que el programa esté compilado y en marcha para medir su rendimiento.   
* **Detección de fallos en tiempo de ejecución:** Ayudan a encontrar errores funcionales, problemas de memoria, fallos de red y vulnerabilidades de seguridad.   
* **Contraste con pruebas estáticas:** A diferencia de las pruebas estáticas (que revisan documentos y código sin ejecutarlo), las dinámicas interactúan con el sistema vivo. 

![][image1]

**Tipos de Pruebas Dinámicas**  
**3.2. Pruebas de caja negra**  
Las pruebas de caja negra evalúan las entradas y salidas de un sistema sin considerar necesariamente su estructura interna.

Se basan en los requisitos funcionales y en el comportamiento esperado.

Entre las técnicas más utilizadas se encuentran:

* **Partición de equivalencia:** divide los datos de entrada en grupos que deberían producir comportamientos similares.  
* **Análisis de valores límite:** examina los extremos de los rangos permitidos.  
* **Tablas de decisión:** permiten comprobar combinaciones de condiciones y acciones.  
* **Pruebas basadas en casos de uso:** evalúan secuencias de interacción del usuario con el sistema.

Por ejemplo, si un sistema permite ingresar edades entre 18 y 65 años, se pueden probar valores inferiores, iguales y superiores a los límites establecidos.

**3.3. Pruebas de caja blanca**  
Las pruebas de caja blanca consideran la estructura interna del código, sus decisiones, condiciones, caminos de ejecución y ciclos.

Su finalidad es comprobar que distintas partes de la implementación sean recorridas y evaluadas adecuadamente.

Algunas técnicas son:

* Cobertura de sentencias.  
* Cobertura de ramas o decisiones.  
* Cobertura de condiciones.  
* Pruebas de caminos.  
* Pruebas de bucles.

Estas técnicas ayudan a identificar partes del código que no han sido ejecutadas durante las pruebas. Sin embargo, recorrer una sentencia no demuestra automáticamente que su resultado sea correcto.

**3.4. Pruebas manuales y automatizadas**  
Las pruebas manuales son ejecutadas por una persona que sigue un procedimiento y registra los resultados. Son útiles para explorar el sistema, evaluar la usabilidad y analizar situaciones   
difíciles de automatizar.

Las pruebas automatizadas utilizan herramientas y scripts para ejecutar comprobaciones de manera repetible. Son especialmente útiles para pruebas de regresión, validaciones frecuentes y procesos integrados en la integración continua.

**Herramientas populares**

* **Selenium / Appium:** Automatización de navegadores web y aplicaciones móviles.  
* **Postman:** Pruebas y diseño de APIs.  
* **JMeter:** Pruebas de carga y estrés.  
* **Katalon Studio:** Solución integral para web, escritorio y móviles

Una estrategia equilibrada combina ambos enfoques. La automatización no elimina la necesidad del análisis humano, sino que permite reservar tiempo para actividades que requieren interpretación, creatividad y juicio crítico.

**3.5. Pruebas de regresión**  
Las pruebas de regresión verifican que una modificación del software no haya afectado funcionalidades que anteriormente funcionaban correctamente.

Se ejecutan, por ejemplo, después de corregir un defecto, incorporar una nueva funcionalidad, actualizar una dependencia o modificar una base de datos.

Automatizar las pruebas de regresión permite detectar rápidamente efectos no deseados de los cambios.

**4\. Herramientas de pruebas unitarias**  
Las pruebas unitarias evalúan unidades pequeñas del software, como funciones, métodos o clases, de manera aislada. Su objetivo es comprobar que cada unidad produzca los resultados esperados para determinadas entradas y condiciones.

Habitualmente se utilizan datos controlados y, cuando corresponde, objetos simulados (*mocks*) o sustitutos (*stubs*) para evitar dependencias innecesarias con bases de datos, servicios externos u otros componentes.

Una prueba unitaria suele organizarse en tres etapas:

1. **Arrange:** preparar los datos y las condiciones iniciales.  
2. **Act:** ejecutar la función que se desea probar.  
3. **Assert:** comparar el resultado obtenido con el esperado.

**4.1. JUnit**  
JUnit es un framework ampliamente utilizado para realizar pruebas automatizadas en Java. Permite definir casos de prueba, ejecutar métodos bajo distintas condiciones y verificar resultados mediante aserciones.

Entre sus características se destacan:

* Organización de pruebas en clases y métodos.  
* Aserciones para comprobar resultados.  
* Preparación y limpieza del entorno de prueba.  
* Ejecución desde entornos de desarrollo y herramientas de construcción.  
* Integración con pipelines de integración continua.

Ejemplo de una prueba con JUnit 5:  
import org.junit.jupiter.api.Test;  
import static org.junit.jupiter.api.Assertions.assertEquals;

class CalculadoraTest {

    @Test  
    void debeSumarDosNumeros() {  
        Calculadora calculadora \= new Calculadora();

        int resultado \= calculadora.sumar(3, 5);

        assertEquals(8, resultado);  
    }  
}  
La prueba verifica que el método sumar devuelva 8 cuando recibe los valores 3 y 5\.

**4.2. PyTest**  
PyTest es un framework de pruebas para Python que permite escribir pruebas de manera sencilla y ampliar su funcionalidad mediante fixtures, parametrización y complementos.  
Sus principales ventajas incluyen:

* Sintaxis simple y legible.  
* Detección automática de funciones de prueba según convenciones de nombres.  
* Mensajes de error detallados.  
* Ejecución selectiva de pruebas.  
* Parametrización para evaluar múltiples conjuntos de datos.  
* Integración con herramientas de automatización.

Ejemplo:  
from calculadora import sumar

def test\_sumar\_dos\_numeros():  
    assert sumar(3, 5\) \== 8  
La instrucción assert permite comprobar que el resultado de la función coincida con el valor esperado. Si la condición no se cumple, PyTest informa el fallo.

**4.3. Otras herramientas**  
Además de JUnit y PyTest, existen herramientas que responden a distintos lenguajes y necesidades.

| Herramienta | Lenguaje o entorno | Aplicación principal |
| :---- | :---- | :---- |
| NUnit | C\# y .NET | Pruebas unitarias. |
| xUnit.net | .NET | Pruebas unitarias e integración con herramientas de desarrollo. |
| Jest | JavaScript y TypeScript | Pruebas unitarias y de componentes. |
| Vitest | JavaScript y TypeScript | Pruebas rápidas en proyectos modernos de frontend. |
| PHPUnit | PHP | Pruebas unitarias. |
| Go testing | Go | Pruebas automatizadas integradas en el lenguaje. |

La selección debe considerar el lenguaje utilizado, el ecosistema del proyecto, la facilidad de integración y las necesidades de mantenimiento.

**5\. Pruebas de integración y de sistema**  
**5.1. Pruebas de integración**  
Las pruebas de integración verifican la interacción entre módulos, componentes o servicios. Buscan detectar defectos relacionados con interfaces, formatos de datos, comunicación, configuración y dependencias.  
Un módulo puede funcionar correctamente de manera aislada y fallar al interactuar con otro debido a diferencias en los contratos, incompatibilidades de tipos o errores de comunicación.

Por ejemplo, en una aplicación de gestión académica, se puede comprobar que el módulo de cuotas envíe correctamente el importe y el identificador del estudiante al módulo de pagos, y que la respuesta se registre en el historial de transacciones.

Entre las estrategias de integración se encuentran:

* **Big Bang:** se integran varios componentes y se prueba el conjunto.  
* **Top-down:** se comienza por los componentes de mayor nivel y se incorporan sus dependencias.  
* **Bottom-up:** se prueban primero los componentes de menor nivel.  
* **Integración incremental:** se incorporan y prueban componentes progresivamente.

La integración incremental facilita localizar el origen de los defectos, aunque su conveniencia depende de la arquitectura y de la disponibilidad de componentes.

**5.2. Pruebas de sistema**  
Las pruebas de sistema evalúan el sistema completo e integrado para comprobar el cumplimiento de sus requisitos funcionales y no funcionales.

Incluyen, según el proyecto:

* Pruebas funcionales.  
* Pruebas de rendimiento y carga.  
* Pruebas de seguridad.  
* Pruebas de compatibilidad.  
* Pruebas de recuperación ante fallos.  
* Pruebas de usabilidad y accesibilidad.

Por ejemplo, en un sistema de pagos, una prueba de sistema puede verificar el inicio de sesión, la consulta de deuda, la selección de conceptos, el registro de un pago, la actualización del saldo y la generación del comprobante.

Estas pruebas permiten evaluar el comportamiento del producto como una unidad, en condiciones próximas a las de su utilización.

**6\. Pruebas de aceptación**  
Las pruebas de aceptación tienen como objetivo determinar si el sistema cumple los criterios de aceptación definidos y si está preparado para su entrega o utilización.

Pueden ser realizadas por usuarios, clientes, responsables del negocio, representantes de la organización o equipos independientes, según el proceso de desarrollo.

Se distinguen distintas modalidades:

* **Aceptación del usuario (UAT):** comprueba que el sistema responda a los procesos y necesidades de los usuarios.  
* **Aceptación operativa:** evalúa si el sistema puede instalarse, operarse, respaldarse y mantenerse adecuadamente.  
* **Pruebas alfa:** se realizan en un entorno controlado, habitualmente con participación cercana del equipo desarrollador.  
* **Pruebas beta:** permiten obtener experiencia de uso en condiciones más próximas a las reales, con usuarios seleccionados o externos.

Las pruebas de aceptación deben diseñarse a partir de criterios verificables. Por ejemplo: “Cuando un estudiante registra un pago aprobado, el sistema debe actualizar el saldo pendiente y permitir consultar el comprobante correspondiente”.

El resultado de estas pruebas proporciona evidencia para aceptar el producto, solicitar correcciones o condicionar su puesta en producción.

**7\. Pruebas automatizadas de interfaz: Selenium y Cypress**  
Las pruebas de interfaz verifican el comportamiento del sistema a través de los elementos con los que interactúa el usuario: formularios, botones, menús, mensajes, tablas y pantallas.

La automatización permite reproducir acciones, introducir datos, comprobar respuestas y ejecutar escenarios repetidamente en distintos navegadores o entornos compatibles.

**7.1. Selenium**  
Selenium es un conjunto de herramientas para automatizar navegadores web. WebDriver permite controlar el navegador mediante instrucciones programáticas, por ejemplo, abrir una página, completar un formulario, pulsar un botón y verificar el resultado.  
Entre sus características se encuentran:

* Compatibilidad con diversos lenguajes de programación.  
* Automatización de navegadores compatibles.  
* Posibilidad de ejecutar pruebas en diferentes sistemas y configuraciones.  
* Integración con frameworks de pruebas y pipelines de CI/CD.  
* Utilización en pruebas funcionales y de regresión de aplicaciones web.

Selenium resulta especialmente útil cuando el proyecto requiere automatización mediante distintos lenguajes o una infraestructura de ejecución distribuida.

**7.2. Cypress**  
Cypress es una herramienta de pruebas orientada al desarrollo y la automatización de aplicaciones web modernas. Ofrece capacidades para ejecutar pruebas de interfaz, comprobar interacciones y observar el comportamiento de la aplicación durante su ejecución.

Entre sus características se destacan:

* API de pruebas basada principalmente en JavaScript y TypeScript.  
* Ejecución de pruebas de extremo a extremo.  
* Capacidades para pruebas de componentes.  
* Esperas automáticas para determinadas condiciones de la interfaz.  
* Herramientas de diagnóstico para analizar fallos.  
* Integración con flujos de desarrollo y automatización.

La selección entre Selenium y Cypress depende de las tecnologías del proyecto, los navegadores y entornos que deban cubrirse, las capacidades del equipo y los requisitos de integración.

**7.3. Comparación entre Selenium y Cypress**

| Criterio | Selenium | Cypress |
| :---- | :---- | :---- |
| Enfoque | Automatización de navegadores mediante WebDriver. | Pruebas de aplicaciones web con herramientas integradas para el desarrollo. |
| Lenguajes | Admite varios lenguajes mediante sus bindings. | Se utiliza principalmente con JavaScript y TypeScript. |
| Navegadores | Amplio ecosistema de navegadores compatibles. | Compatibilidad según las versiones y los navegadores admitidos por la herramienta. |
| Diagnóstico | Depende del framework y de las herramientas complementarias. | Incluye herramientas de depuración y observación de la ejecución. |
| Uso frecuente | Automatización multiplataforma y suites funcionales. | Pruebas de aplicaciones web y flujos de extremo a extremo. |

Ambas herramientas pueden mejorar la repetibilidad de las pruebas, pero ninguna garantiza por sí sola la calidad del software. Es necesario diseñar casos de prueba relevantes, mantenerlos actualizados y analizar los resultados.

**8\. Calidad de software**  
La calidad de software es el grado en que un producto satisface los requisitos establecidos y las necesidades de los usuarios, considerando tanto sus funciones como sus atributos no funcionales.

La calidad no debe entenderse exclusivamente como ausencia de errores. Un producto también debe ser seguro, eficiente, comprensible, accesible, compatible y mantenible, de acuerdo con su contexto de utilización.

La norma ISO/IEC 25010 establece un modelo de calidad de producto que contempla características como:

* **Adecuación funcional:** capacidad de proporcionar funciones apropiadas para las necesidades previstas.  
* **Eficiencia del desempeño:** comportamiento en relación con los recursos utilizados y el rendimiento.  
* **Compatibilidad:** capacidad de coexistir e interoperar con otros sistemas.  
* **Capacidad de interacción:** facilidad y adecuación de la interacción entre usuarios y sistema.  
* **Fiabilidad:** capacidad de mantener un comportamiento adecuado bajo determinadas condiciones.  
* **Seguridad:** protección de la información y de los recursos frente a accesos y acciones no autorizados.  
* **Mantenibilidad:** facilidad para analizar, modificar, probar y mejorar el software.  
* **Flexibilidad:** capacidad de adaptación o instalación en distintos entornos, según el modelo y la edición de la norma aplicable.

La evaluación de estas características requiere combinar pruebas, revisiones, mediciones y análisis del contexto. No todas tienen el mismo peso en todos los proyectos: en un sistema financiero, por ejemplo, la seguridad y la integridad de los datos adquieren especial importancia.

**8.1. Aseguramiento y control de calidad**  
El aseguramiento de la calidad comprende las actividades planificadas y sistemáticas destinadas a proporcionar confianza en que los procesos y productos cumplirán los requisitos de calidad.

El control de calidad se concentra en examinar el producto y sus resultados para detectar incumplimientos y defectos.

En términos generales, las revisiones de procesos, la definición de estándares y la mejora continua contribuyen al aseguramiento; las inspecciones y la ejecución de pruebas permiten realizar actividades de control. Ambos enfoques deben coordinarse durante todo el ciclo de vida.

**9\. Gestión de defectos**  
Un defecto es una imperfección o problema presente en un requisito, diseño, código u otro artefacto del software. Cuando ese defecto se ejecuta bajo determinadas condiciones, puede provocar una falla observable.

La gestión de defectos comprende el registro, análisis, clasificación, asignación, corrección, verificación y cierre de los problemas identificados.

**9.1. Ciclo de vida de un defecto**  
Un flujo habitual incluye los siguientes estados:

1. **Nuevo:** se registra el defecto.  
2. **Asignado:** se designa un responsable para analizarlo o corregirlo.  
3. **En análisis o corrección:** se investiga la causa y se implementa una solución.  
4. **Corregido:** se informa que el cambio fue realizado.  
5. **En verificación:** se vuelve a probar la funcionalidad.  
6. **Cerrado:** se confirma que el defecto fue resuelto.  
7. **Reabierto:** se utiliza si el problema persiste o reaparece.

Los nombres y las transiciones pueden variar según la herramienta y el proceso del equipo.

**9.2. Severidad y prioridad**  
La severidad expresa el impacto técnico o funcional del defecto. La prioridad determina la urgencia con la que debe atenderse.

Por ejemplo, una falla que impide registrar pagos puede tener severidad alta y prioridad inmediata. Un error menor de alineación visual puede tener severidad baja, aunque su prioridad podría aumentar si afecta una pantalla crítica de uso frecuente.

No deben confundirse ambos conceptos: un defecto técnicamente grave no siempre tiene la misma prioridad que otro que afecta una operación comercial urgente.

**9.3. Información de un reporte de defecto**  
Un reporte útil debería incluir:

* Identificador único.  
* Título y descripción.  
* Pasos para reproducir el problema.  
* Resultado esperado y resultado obtenido.  
* Evidencias, como capturas, registros o mensajes de error.  
* Entorno y versión del sistema.  
* Severidad y prioridad.  
* Estado y responsable.  
* Requisitos o casos de prueba relacionados.

Una gestión adecuada facilita la comunicación del equipo, permite analizar tendencias y contribuye a prevenir la repetición de problemas similares.

**10\. Matriz de trazabilidad de requisitos**  
La matriz de trazabilidad es un instrumento que relaciona los requisitos del sistema con los artefactos y actividades que permiten implementarlos y comprobarlos.

Puede vincular requisitos con casos de uso, módulos, componentes de código, casos de prueba, defectos y resultados de ejecución. De esta manera, permite comprobar si cada requisito tiene una implementación asociada y evidencia suficiente de verificación o validación.

**10.1. Ejemplo de matriz de trazabilidad**

| ID | Requisito | Caso de prueba | Resultado | Estado |
| :---- | :---- | :---- | :---- | :---- |
| RF-01 | El sistema debe permitir iniciar sesión con credenciales válidas. | CP-01: inicio de sesión válido. | Acceso autorizado. | Aprobado |
| RF-02 | El sistema debe calcular el saldo pendiente de un estudiante. | CP-02: cálculo del saldo. | Saldo coincidente con los movimientos registrados. | Aprobado |
| RF-03 | El sistema debe registrar pagos aprobados. | CP-03: registro de pago. | El pago se guarda y se actualiza el saldo. | Pendiente |
| RF-04 | El sistema debe generar un comprobante de pago. | CP-04: generación del comprobante. | No ejecutado. | Sin probar |

Este ejemplo es ilustrativo. En un proyecto real, los estados deben actualizarse a partir de ejecuciones efectivas y evidencias registradas.

**10.2. Importancia de la trazabilidad**  
La matriz de trazabilidad permite:

* Detectar requisitos que no tienen casos de prueba.  
* Identificar pruebas que no están asociadas con requisitos o riesgos conocidos.  
* Evaluar el impacto de los cambios.  
* Facilitar auditorías y revisiones.  
* Organizar las pruebas de regresión.  
* Aportar evidencia del cumplimiento de los requisitos.

La trazabilidad debe mantenerse durante el desarrollo. Una matriz desactualizada puede producir una falsa impresión de cobertura y dificultar el control de cambios.

**11\. Cobertura de código (*Code Coverage*)**  
La cobertura de código es una métrica que indica qué proporción de determinados elementos del código fue ejecutada durante las pruebas. Ayuda a identificar zonas que no han sido ejercitadas y permite orientar la incorporación de nuevos casos de prueba.

**11.1. Tipos de cobertura**  
**Cobertura de sentencias:** mide la proporción de sentencias ejecutadas al menos una vez.  
**Cobertura de ramas:** mide la proporción de resultados posibles de las decisiones que fueron recorridos. Por ejemplo, las ramas verdadera y falsa de una condición.  
**Cobertura de condiciones:** analiza si las condiciones individuales de una expresión lógica adoptaron los valores previstos durante las pruebas.  
**Cobertura de funciones o métodos:** indica qué proporción de funciones o métodos fue invocada.  
**Cobertura de caminos:** analiza los caminos de ejecución posibles. Su cálculo completo puede resultar impracticable cuando existen numerosas combinaciones, ciclos o condiciones.

**11.2. Cálculo de cobertura de sentencias**  
La cobertura de sentencias puede calcularse mediante la siguiente expresión:  
\[  
\\text{Cobertura} \=  
\\frac{\\text{Sentencias ejecutadas}}  
{\\text{Total de sentencias consideradas}}  
\\times 100  
\]  
Si un conjunto de pruebas ejecuta 80 de las 100 sentencias consideradas, la cobertura de sentencias es del 80 %.

**11.3. Interpretación y limitaciones**  
Una cobertura elevada no garantiza que las pruebas sean suficientes ni que el sistema esté libre de defectos. Una prueba puede ejecutar una sentencia sin verificar correctamente su resultado o sin evaluar los casos límite.

Por esta razón, la cobertura debe interpretarse junto con otros indicadores, como:

* Calidad y relevancia de los casos de prueba.  
* Cobertura de requisitos.  
* Cobertura de ramas.  
* Defectos detectados durante las pruebas.  
* Resultados de pruebas de regresión.  
* Análisis de riesgos.

El objetivo no debería ser alcanzar un porcentaje de cobertura de manera aislada, sino obtener evidencia suficiente sobre los comportamientos importantes del sistema.

**12\. Monitoreo de calidad y métricas**  
El monitoreo de calidad permite conocer el estado del producto y la eficacia del proceso de pruebas mediante indicadores medibles.

Las métricas deben interpretarse según el contexto, la evolución temporal y los objetivos del proyecto. Un valor aislado no siempre explica las causas de un problema.

**12.1. Principales métricas**

| Métrica | Descripción | Utilidad |
| :---- | :---- | :---- |
| Porcentaje de pruebas aprobadas | Pruebas aprobadas sobre el total de pruebas ejecutadas. | Conocer el resultado de una ejecución. |
| Cobertura de código | Proporción de elementos de código ejecutados. | Identificar zonas no ejercitadas. |
| Densidad de defectos | Cantidad de defectos respecto del tamaño del software, según una unidad definida. | Comparar tendencias con criterios consistentes. |
| Tasa de defectos reabiertos | Proporción de defectos reabiertos respecto del total definido para el análisis. | Evaluar la estabilidad de las correcciones. |
| Tiempo medio de resolución | Tiempo promedio requerido para resolver defectos. | Analizar la capacidad de respuesta. |
| Defectos escapados | Defectos detectados después de una entrega o puesta en producción. | Evaluar la efectividad de los controles previos. |
| Tasa de fallos de cambios | Proporción de cambios desplegados que provocan incidentes o requieren intervención correctiva. | Analizar la confiabilidad del proceso de entrega. |
| Tiempo de ejecución de pruebas | Duración de una suite o conjunto de pruebas. | Detectar demoras y optimizar el pipeline. |

Cada métrica requiere una definición operacional clara. Por ejemplo, la tasa de pruebas aprobadas puede calcularse como:  
\[  
\\text{Tasa de aprobación} \=  
\\frac{\\text{Pruebas aprobadas}}  
{\\text{Pruebas ejecutadas}}  
\\times 100  
\]  
Si se ejecutan 200 pruebas y 190 resultan aprobadas, la tasa de aprobación es del 95 %. Las diez pruebas restantes deben analizarse para determinar si corresponden a defectos, problemas de configuración, datos inadecuados o fallos de la propia prueba.

**12.2. Herramientas para monitorear la calidad**  
Existen herramientas que reúnen resultados de pruebas, análisis estático, cobertura y otros indicadores:

* **SonarQube:** analiza código y permite monitorear reglas de calidad, problemas de mantenibilidad y otros aspectos configurados.  
* **JaCoCo:** mide cobertura de código en proyectos Java.  
* **Coverage.py:** mide cobertura de código Python.  
* **pytest-cov:** integra la medición de cobertura con PyTest.  
* **GitHub Actions y GitLab CI/CD:** permiten automatizar la ejecución de pruebas y publicar sus resultados dentro de los procesos de integración y entrega.  
* **Allure Report:** facilita la presentación de informes de ejecución de pruebas, según la integración disponible.

Las herramientas deben seleccionarse de acuerdo con el lenguaje, la arquitectura y las necesidades del proyecto. Sus resultados requieren interpretación y no reemplazan la revisión técnica.

**13\. Uso de frameworks y entornos de prueba**  
**13.1. Frameworks de prueba**  
Un framework de pruebas proporciona estructuras, convenciones y herramientas que simplifican la definición, ejecución y organización de casos de prueba.

Puede ofrecer aserciones, preparación de datos, configuración del entorno, parametrización, agrupación de pruebas e informes de resultados.

Ejemplos habituales son JUnit para Java, PyTest para Python, Jest para JavaScript y NUnit para .NET. Selenium y Cypress se utilizan principalmente para automatizar interacciones con aplicaciones web, aunque su alcance depende de las capacidades concretas y de las herramientas complementarias empleadas.

La utilización de frameworks favorece la repetibilidad, la organización y el mantenimiento de las pruebas, siempre que se adopten convenciones claras.

**13.2. Entornos de prueba**  
Un entorno de prueba comprende la infraestructura, el software, los datos y la configuración necesarios para ejecutar las pruebas.

Puede incluir:

* Sistema operativo y navegador.  
* Versiones del lenguaje y sus dependencias.  
* Servidores y bases de datos.  
* Servicios externos o simulaciones de esos servicios.  
* Variables de entorno y credenciales de prueba.  
* Datos controlados y mecanismos de restauración.  
* Herramientas de registro y monitoreo.

Es conveniente separar los entornos de desarrollo, prueba y producción. Las pruebas deben realizarse con datos controlados y medidas apropiadas de seguridad, evitando exponer información personal o credenciales reales.  
**13.3. Integración continua y automatización**  
La integración continua permite incorporar cambios de código frecuentemente y ejecutar verificaciones automatizadas para detectar problemas de manera temprana.

Un pipeline básico de calidad puede incluir:

1. Recuperación del código desde el repositorio.  
2. Instalación de dependencias.  
3. Análisis estático y comprobación de estilo.  
4. Ejecución de pruebas unitarias.  
5. Ejecución de pruebas de integración.  
6. Medición de cobertura.  
7. Ejecución de pruebas de interfaz cuando corresponda.  
8. Publicación de informes y notificación de resultados.

El equipo puede establecer condiciones para impedir la integración o la entrega cuando fallan pruebas críticas o se incumplen determinados criterios de calidad.

La automatización debe acompañarse de una estrategia de mantenimiento de pruebas, gestión de datos y análisis de falsos positivos. Una prueba automatizada que falla de manera intermitente sin una causa identificada puede reducir la confianza en el pipeline.

**14\. Integración de las pruebas en el ciclo de desarrollo**  
Las pruebas deben planificarse desde las primeras etapas del proyecto. Esperar hasta que el sistema esté terminado puede incrementar el costo de las correcciones y dificultar la identificación de las causas de los defectos.

Una estrategia integrada contempla:

* **Análisis de requisitos:** definir criterios de aceptación y condiciones verificables.  
* **Diseño:** identificar riesgos, interfaces y escenarios de prueba.  
* **Implementación:** escribir pruebas unitarias y aplicar revisiones de código.  
* **Integración:** comprobar la comunicación entre módulos y servicios.  
* **Validación del sistema:** ejecutar pruebas funcionales y no funcionales.  
* **Aceptación:** evaluar el producto frente a los criterios acordados.  
* **Mantenimiento:** ejecutar pruebas de regresión ante modificaciones y correcciones.

Este enfoque permite distribuir las actividades de calidad a lo largo del desarrollo y no concentrarlas en una única fase final.

**15\. Desafíos y buenas prácticas**  
La aplicación de pruebas presenta desafíos técnicos y organizacionales. Entre ellos se encuentran los recursos limitados, la falta de requisitos precisos, los entornos difíciles de reproducir, las pruebas frágiles y la ausencia de criterios claros para evaluar los resultados.

Para mejorar el proceso se recomienda:

1. Priorizar los casos de prueba según el riesgo y el impacto de las fallas.  
2. Definir requisitos verificables y criterios de aceptación claros.  
3. Automatizar primero las pruebas repetitivas y de mayor valor.  
4. Mantener las pruebas actualizadas junto con el código.  
5. Utilizar datos controlados y entornos reproducibles.  
6. Registrar defectos con evidencias suficientes.  
7. Relacionar requisitos, pruebas y defectos mediante trazabilidad.  
8. Interpretar la cobertura como un indicador complementario.  
9. Revisar las métricas de manera periódica.  
10. Incorporar seguridad, rendimiento y usabilidad según el contexto del producto.

La calidad depende tanto de las herramientas como de las decisiones técnicas, los procesos de trabajo y la capacidad del equipo para aprender de los defectos detectados.

**16\. Conclusión**  
La verificación, la validación y las pruebas de software son componentes esenciales de la ingeniería de software porque permiten evaluar la conformidad técnica de los productos y su adecuación a las necesidades de los usuarios.

La verificación examina si los artefactos y el software cumplen las especificaciones establecidas, mientras que la validación busca determinar si el producto responde a su finalidad y a las expectativas de quienes lo utilizan. Las pruebas unitarias, de integración, de sistema, de aceptación y de interfaz aportan evidencias desde distintos niveles y perspectivas.

Herramientas como JUnit, PyTest, Selenium y Cypress facilitan la automatización de comprobaciones y contribuyen a mejorar la repetibilidad de las pruebas. A su vez, la gestión de defectos, las matrices de trazabilidad y las métricas de cobertura permiten organizar el trabajo, identificar riesgos y monitorear la evolución de la calidad.

No obstante, la calidad no puede reducirse a una cantidad de pruebas aprobadas ni a un porcentaje de cobertura. Requiere una estrategia que combine criterios técnicos, análisis de riesgos, pruebas adecuadas, participación de los usuarios y mejora continua.

En consecuencia, incorporar la calidad durante todo el ciclo de desarrollo permite detectar problemas tempranamente, reducir costos de mantenimiento y construir sistemas más confiables, seguros y sostenibles. La elección de herramientas y métricas debe responder a los objetivos del proyecto y complementarse con el juicio profesional del equipo de desarrollo.

**17\. Bibliografía**  
Ammann, P., & Offutt, J. (2016). *Introduction to software testing* (2nd ed.). Cambridge University Press.  
Fowler, M. (2006). *Continuous integration*. Martin Fowler. [https\://martinfowler.com/articles/continuousIntegration.html](https://martinfowler.com/articles/continuousIntegration.html)  
Graham, D., Black, R., & van Veenendaal, E. (2019). *Foundations of software testing: ISTQB certification* (4th ed.). Cengage Learning.  
International Organization for Standardization. (2023). *ISO/IEC 25002:2023 Systems and software engineering—Systems and software Quality Requirements and Evaluation (SQuaRE)—Quality model overview and usage*. ISO.  
International Organization for Standardization, & International Electrotechnical Commission. (2023). *ISO/IEC/IEEE 29119-1:2022 Software and systems engineering—Software testing—Part 1: General concepts* (publicada en 2022). ISO.  
Myers, G. J., Sandler, C., & Badgett, T. (2011). *The art of software testing* (3rd ed.). John Wiley & Sons.

Documentación oficial de herramientas:

* Cypress. (s. f.). *Cypress documentation*. [https\://docs.cypress.io/](https://docs.cypress.io/)  
* JUnit. (s. f.). *JUnit 5 user guide*. [https\://junit.org/junit5/docs/current/user-guide/](https://junit.org/junit5/docs/current/user-guide/)  
* PyTest. (s. f.). *PyTest documentation*. [https\://docs.pytest.org/](https://docs.pytest.org/)  
* Selenium. (s. f.). *Selenium documentation*. [https\://www\.selenium.dev/documentation/](https://www.selenium.dev/documentation/)  
* SonarSource. (s. f.). *SonarQube documentation*. [https\://docs.sonarsource.com/](https://docs.sonarsource.com/)

**Calidad de software**

**Introducción**

El software está presente en actividades cotidianas y en sectores como la educación, la salud, las finanzas, el comercio y la industria. Por ello, no basta con que un programa funcione: también debe ser seguro, confiable, fácil de usar y adecuado para las necesidades de quienes lo utilizan. Estas propiedades se relacionan con la \*\*calidad de software\*\*.

La calidad no depende únicamente del producto terminado. También está influida por la manera en que se definen los requisitos, se diseña, se programa, se prueba y se mantiene el sistema. Esta monografía presenta el concepto de calidad de software, sus principales características, los procesos para evaluarla y su importancia.

**1\. Concepto de calidad de software**  
La calidad de software es el grado en que un producto cumple los requisitos establecidos y satisface las necesidades de sus usuarios y otras partes interesadas. Incluye tanto características visibles —como la facilidad de uso— como aspectos internos, por ejemplo, la organización del código y la facilidad para corregirlo.

Un producto puede cumplir su función principal y, aun así, ser de baja calidad si falla con frecuencia, expone información sensible o resulta difícil de mantener. Por esta razón, la calidad debe considerarse desde las primeras etapas del desarrollo y no limitarse a las pruebas finales.

**2\. Características principales**  
Entre las características más importantes se encuentran:

- Adecuación funcional: el sistema ofrece las funciones necesarias y produce resultados correctos.  
- Fiabilidad: mantiene un comportamiento estable y consistente durante un periodo determinado.  
- Usabilidad: permite que las personas aprendan y utilicen el sistema con facilidad.  
- Eficiencia: aprovecha adecuadamente recursos como memoria, capacidad de procesamiento y tiempo de respuesta.  
- Seguridad: protege los datos y restringe el acceso a usuarios autorizados.  
- Compatibilidad: puede coexistir e intercambiar información con otros sistemas.  
  Mantenibilidad: facilita la corrección de errores, la actualización y la incorporación de mejoras.  
- Portabilidad:puede adaptarse o trasladarse a diferentes plataformas o entornos.

Estas características pueden entrar en tensión. Por ejemplo, reforzar la seguridad puede añadir pasos al inicio de sesión y afectar la comodidad de uso. El equipo de desarrollo debe equilibrarlas según el propósito del sistema y las necesidades de sus usuarios.

**3\. Calidad del producto y calidad del proceso**  
La \*\*calidad del producto\*\* se refiere a las propiedades del software entregado: su funcionamiento, seguridad, rendimiento y facilidad de uso, entre otras.

La \*\*calidad del proceso\*\* corresponde a la forma en que se desarrolla y mantiene ese software. Un proceso organizado ayuda a reducir errores, controlar cambios, documentar decisiones y verificar que el producto cumpla los requisitos. Sin embargo, seguir un proceso formal no garantiza por sí solo un buen resultado: este debe ser apropiado para el proyecto y aplicarse de manera efectiv

**4\. Aseguramiento y control de calidad**

El \*\*aseguramiento de la calidad\*\* comprende las actividades planificadas para prevenir problemas y comprobar que el proceso de desarrollo sea adecuado. Puede incluir estándares de trabajo, revisiones, capacitación y auditorías.

El \*\*control de calidad\*\* se centra en identificar defectos en el producto. Para ello se emplean, entre otras técnicas:

- Pruebas unitarias: verifican componentes pequeños, como funciones o módulos.  
- Pruebas de integración: comprueban que los componentes trabajen correctamente juntos.  
- Pruebas del sistema: evalúan el comportamiento del sistema completo.  
- Pruebas de aceptación: determinan si el producto satisface las necesidades y criterios acordados con el cliente.  
- Revisiones de código: permiten detectar errores y mejorar la claridad y consistencia del código.

Las pruebas no pueden demostrar que un programa está libre de todo defecto, pero sí ayudan a encontrar fallas importantes y a reducir el riesgo de que lleguen a las personas usuarias.

**5\. Métricas e indicadores**  
Las métricas permiten observar aspectos de la calidad y apoyar la toma de decisiones. Algunos ejemplos son:

\- cantidad de defectos encontrados antes y después de la entrega;  
\- porcentaje de pruebas aprobadas;  
\- tiempo de respuesta del sistema;  
\- frecuencia de interrupciones;  
\- tiempo promedio para reparar una falla;  
\- satisfacción de los usuarios;  
\- cantidad de cambios necesarios para corregir o ampliar el software.

Una métrica aislada no ofrece una evaluación completa. Por ejemplo, un número alto de pruebas aprobadas no necesariamente significa que se hayan probado los casos más importantes. Las métricas deben interpretarse junto con el contexto, los objetivos del proyecto y la experiencia de los usuarios.

**6\. Importancia de la calidad de software**  
La calidad es importante porque influye directamente en la utilidad y la confianza que genera un sistema. Un software de baja calidad puede provocar pérdidas económicas, interrupciones de servicios, errores en procesos importantes o exposición de datos personales.

En cambio, un producto de calidad puede:  
1\. reducir los costos de corrección y mantenimiento;  
2\. mejorar la experiencia y la satisfacción de los usuarios;  
3\. disminuir fallas y riesgos de seguridad;  
4\. facilitar futuras actualizaciones;  
5\. fortalecer la reputación de la organización que lo ofrece.

La calidad también tiene una dimensión ética. Los equipos deben considerar cómo los errores, las decisiones automatizadas y el tratamiento de datos pueden afectar a las personas.

**7\. Desafíos actuales**  
La calidad de software enfrenta desafíos relacionados con la rapidez del desarrollo, la diversidad de dispositivos y plataformas, la dependencia de servicios externos y la evolución de las amenazas de seguridad. Además, las aplicaciones suelen actualizarse continuamente, por lo que deben verificarse de manera constante.

Otro desafío es comprender las necesidades reales de los usuarios. Requisitos incompletos o ambiguos pueden producir un sistema técnicamente correcto, pero poco útil. La comunicación entre clientes, usuarios, desarrolladores y responsables del proyecto es, por tanto, fundamental.

**Conclusión**  
La calidad de software es un conjunto de características que permite que un sistema cumpla su propósito de manera confiable, segura, eficiente y adecuada para sus usuarios. No se obtiene únicamente mediante pruebas al final del proyecto: requiere atención durante todo el ciclo de vida del software, desde la definición de requisitos hasta el mantenimiento.

Para alcanzarla, es necesario combinar procesos apropiados, buenas prácticas de desarrollo, pruebas, revisiones y evaluación continua. También se deben considerar las necesidades de las personas y los riesgos asociados al uso del sistema. En un entorno cada vez más dependiente de la tecnología, desarrollar software de calidad es una responsabilidad técnica y social.

 **Bibliografía**  
\- International Organization for Standardization. (2023). \*ISO/IEC 25010: Systems and software engineering — Systems and software Quality Requirements and Evaluation (SQuaRE) — Product quality model\*.  
\- International Organization for Standardization. (2011). \*ISO/IEC 25010: Systems and software engineering — Systems and software Quality Requirements and Evaluation (SQuaRE) — System and software quality models\*.  
\- Pressman, R. S., y Maxim, B. R. (2020). \*Software Engineering: A Practitioner’s Approach\*. McGraw-Hill.  
\- Sommerville, I. (2016). \*Software Engineering\* (10.ª ed.). Pearson.

[image1]: <data:image/png;base64,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>