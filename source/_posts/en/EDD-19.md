---
title: Extremadura Digital day 2019
date: 2019-10-06 19:00:00
lang: en
label: events
tags: 
    - aws
    - s3
    - dynamodb
    - lambda
    - api-gateway
    - cognito
    - serverless-framework
    - serverless
    - fullstack
    - nodejs
    - workshop
    - events
categories: events
---

![](/images/edd-2019.jpg)

Este año, también he tenido la oportunidad de participar como ponente en el evento tecnológico más puntero del momento en Extremadura, y quisiera compartir en el blog impresiones y sensaciones sobre la experiencia de este año.

<!-- more -->

En primer lugar agradecer a la organización el esfuerzo y el trabajo realizado para poner en funcionamiento un evento como este, sé de buena tinta lo que implica, y tiene mucho mérito lo que han logrado.

Como en casi todo en esta vida, siempre hay margen de mejora, pero en términos generales, el evento funcionó a la perfección, todo estuvo bien distribuido, no hubo incidentes, el horario fluyó adecuadamente, la calidad de los contenidos fue muy alta, los voluntarios y el personal técnico hicieron un trabajo excepcional y había mejoras visibles sobre lo que fue EDD18.

Sobre la _estructura_ del evento, destacaron desde mi punto de vista, las impresionantes instalaciones del [Centro de Cirugía de Mínima Invasión Jesús Usón](https://www.ccmijesususon.com) claramente preparado para congresos de alta envergadura. Las salas eran amplias, muy cómodas y tenían un despliegue técnico muy profesional. El único punto que empañó la perfección estuvo en la conexión wifi, que no permitía muchas florituras.

Otra de las cosas que más me gustó, fue el gesto que se promovió entre la organización y los ponentes de ceder parte del presupuesto del evento que estaba pensado para costes de desplazamiento de ponentes a Cruz Roja Infantil aquí en Cáceres. Al final del evento, se realizó la entrega simbólica, pero los niños ingresados en el hospital de Cáceres recibirán algunos juguetes y actividades que les ayuden a sobrellevar su estancia allí. Un gesto muy bonito.

En cuanto a contenido, las charlas que más me gustaron fueron las de [@sailormerqury](https://twitter.com/sailormerqury) en [Caja negra, caja blanca y el futuro inmediato de la Inteligencia Artificial](https://2019.extremaduradigitalday.com/ponente/nerea-luis/) que invitaba a la reflexión sobre el impacto de la IA en la sociedad, la de [@Fortiz2305](https://twitter.com/Fortiz2305) sobre [Equipos de alto de rendimiento: qué son y cómo identificarlos](https://2019.extremaduradigitalday.com/ponente/francisco-ortiz-abril/) que explicaba de forma muy sencilla y directa cómo son los equipos de alto rendimiento en el mundo del software y por qué, y la de [@MariaJesusRuiz7
](https://twitter.com/MariaJesusRuiz7) llamada [DELETE FROM estereotipos;](https://2019.extremaduradigitalday.com/ponente/maria-jesus-ruiz-suero/) que apoyada en datos hablaba de la brecha de género digital y daba ideas sobre cosas que podemos hacer para corregirla.

Me quedé con ganas de ver las charlas de [@Ricard0Per](https://twitter.com/Ricard0Per) titulada [Tus secretos más oscuros con Hashicorp Vault](https://2019.extremaduradigitalday.com/ponente/ricardo-pereira/) una herramienta a la que le tengo ganas desde hace tiempo :D y como no, la de [@robermorales](https://twitter.com/robermorales) con un nombre sencillo: [Go 101](https://2019.extremaduradigitalday.com/ponente/rober-morales-chaparro/) que no sólo seguro que estuvo genial, sino que introduce el siguiente lenguaje de programación al que quiero aproximarme. Espero poder verlas en diferido.

No obstante, con lo que más me quedo del evento son las sensaciones de estar allí con mis geniales compañeros y compañeras de trabajo actuales y pasados, en un entorno más distendido y cercano, reencontrarme con otros compañeros y amigos a los que admiro y tengo especial cariño y otras personas con las que a lo mejor no tengo tanto contacto, pero con las que siempre surgen conversaciones muy interesantes.

Por supuesto, todo el _networking_ propio de este tipo de eventos, siempre propicia que además, acabes conociendo a nuevas e interesantes personas que de un modo u otro están implicadas en el apasionante sector del desarrollo de software.

Sobre [mi charla/taller de serverless](https://2019.extremaduradigitalday.com/ponente/juan-manuel-ruiz-fernandezsngular/), he de decir que acabé muy satisfecho con el resultado. El año pasado quizás si estuve un poco más nervioso los momentos antes de [la charla](https://youtu.be/VO2_3wuaNBk?t=7106), pero este año estaba mucho más tranquilo, quizás por el agotamiento (llevaba unos cuantos días muy ajetreados por diversos motivos) o quizás por que había dedicado una cantidad importante de tiempo a su preparación.

Es la primera vez que preparaba una charla/taller y he de decir, que la diferencia principal que he encontrado con respecto a las charlas típicas de 40-45 minutos es que requieren de mucho más tiempo de preparación.

Dado que íbamos a jugar con el código y que mi intención era mostrar el stack completo de una web en serverless que utilizara como mínimo DynamoDB y Cognito, 1h 45 minutos se me antojaban poco para poder hacerlo todo (por muy simple que fuera el proyecto) con ejercicios en los que los asistentes tuvieran que pensar en las soluciones para luego implementarlas. 

Por eso decidí preparar algunos proyectos y uno de ellos, partirlo en pasos claramente diferenciados y testados por separado de forma que si bien los asistentes tenía en sus manos el código final de la solución, podían seguir la guía que había preparado en cada paso para que, sin preocuparse por la implementación del código, pudieran ir avanzando en el proyecto y entendiesen en la medida de lo posible lo que estaban haciendo gracias a la guía y mis explicaciones.

Intenté interactuar mucho con los asistentes, invitándoles a preguntar y reflexionar sobre lo que iba comentando. Soy consciente de que había mucho contenido y una parte importante del mismo, requería de unos conocimientos sobre AWS y conocimientos medianamente avanzados sobre desarrollo web.

No obstante, el ejemplo del proyecto completo creo que aporta un valor extra, porque no sólo se trabajan los conceptos básicos del framework sino que además se ve un resultado palpable.

En general, el feedback que he recibido hasta ahora, es positivo, pero espero haber podido llegar a los asistentes con el mensaje que traté de expresar o al menos, haber suscitado el interés suficiente como para que vuelvan al contenido del taller y lo intenten por sí mismos o se atrevan con los otros ejemplos que dejé en el repo: https://github.com/neovasili/101_serverless_workshop

He dejado en el siguiente enlace también las slides que preparé para el taller: [101 Serverless Framework workshop](https://files.juanmanuelruizfernandez.com/101+Serverless+Framework+workshop.pdf).

Sólo me queda añadir a esta _retrospectiva_ que el _afterparty_ en los [7 jardines](https://lossietejardines.es/galeria), un rincón precioso del casco antiguo cacereño, puso el punto y final a una velada magnífica que ya estoy deseando que se repita en EDD20. Muy contento de haber formado parte de todo esto. Mi más sincera enhorabuena a todos los que lo han hecho posible.

¿Vendrás con nosotros el año que viene? ;)