---
title: Massive import/export data from S3 to DynamoDB
date: 2019-07-15 23:51:46
lang: es
label: massive-import-s3-dynamodb
tags: 
    - aws
    - s3
    - dynamodb
    - dms
    - import
    - export
    - terraform
categories: data-migration
---
![](/images/s3-to-dynamodb.jpg)

Para empezar, quería escribir al menos un post explicando cómo había sido esto de crear un blog serverless, pero lo cierto es que me apetecía escribir primero este post. Hace algún tiempo que lo tengo en mente.

Esta es una de esas historias que se escriben solas.

Prácticamente el primer día en la ofi. Me siento, y a los pocos minutos cuando aún no había casi ni configurado la cuenta del correo corporativo, un compañero me hace una pregunta: 


**Compitrueno** - _"oye, me han dicho que esto de Amazon, tu controlas, ¿no?"_

**Yo** - _"bueno, algo sé"_ - la prudencia al poder -

**Compitrueno** - _"es que verás, tenemos un proyecto en el que estoy trabajando, que tenemos que cargar en una tabla de dynamodb un montón de datos"_ - un csv o datos que podían llevarse fácilmente a un csv - _"y lo estamos haciendo con el SDK de 25 en 25, pero me da que esto va muy lento, ¿sabes si hay alguna otra forma de hacerlo que sea más rápida?"_

**Yo** - Curiosamente, había estado hace pocas semanas preparando la certificación de Big data de AWS - que suspendí como un campeón - y me sonaba que había algo. _"Sí, me suena que hay algo para hacerlo de forma masiva. Déjame un rato a ver si lo encuentro y te digo"_.
<!-- more -->

Efectivamente, con una simple búsqueda, localicé algunos enlaces entre los que estaba uno de la propia documentación oficial de AWS que se hacía usando datapipeline. Se lo comenté a mi compi, y me dijo que no era necesario todavía, así que el tema se quedó ahí y lo retomamos más adelante.

___
**TL;DR** Clonar [mi repositorio de github](https://github.com/neovasili/dms-s3-import-to-dynamodb.git) y seguir los pasos del readme ;)
___

## Discovery phase

Siendo una solución de la propia AWS, confié en que sería lo más óptimo y probablemente la más sencilla de implementar (sí, me he leído, a veces parece que no he aprendido nada con el paso de los años...), así que me puse a ello.

De las primeras cosas que me empezaron a chirriar fue que **datapipeline**, aunque tenía soporte nativo para s3 y dynamodb, por debajo, se levanta un cluster de **EMR** (AWS Elastic Map Reduce), algo que así de primeras, se me antojaba excesivo para nuestro caso de uso. No obstante, tenía sentido, si lo que íbamos a importar era una gran cantidad de datos.

Aunque los había estudiado, era la primera vez que usaba ambos servicios, así que al principio no entendía muy bien cómo funcionaban. Leí algo de documentación y encontré algún esquema que me aclaró un poco más el tema. Acto seguido, me puse a "catarlo".

Segunda cosa que me chirriaba. El invento, tardaba más de 30 minutos sólo en levantarse y otros 15 en morir algo que, por otra parte, era lógico teniendo en cuenta que el cluster tenía tres nodos bastante tochos con mucha fontanería que no me apetecía entender demasiado. Esto iba a suponer un coste importante si se tenía que mantener levantado mucho rato, pero se suponía que iba a ser una sola carga (iluso de mí) y que con toda esa potencia no iba a llevar mucho tiempo.

Y tanto. El proceso de importación con un fichero de pruebas de 120 mil tuplas, a penas llevaba 15 o 20 segundos, pero petaba como una palomita. Lo peor, es que no veía de forma clara dónde estaba el pete y al tercer intento, se me empezaron a hinchar las venas del cráneo y pensé que tenía que haber algo más simple que pudiera servir también.

## DMS

Rebuscando en los avernos encontré [un post del blog oficial de AWS](https://aws.amazon.com/es/blogs/database/migrate-delimited-files-from-amazon-s3-to-an-amazon-dynamodb-nosql-table-using-aws-database-migration-service-and-aws-cloudformation/) que decía que se podía usar **AWS Database Migration Service** (DMS) para utilizar como fuente s3 y destino dynamodb. Así que parecía que había otra alternativa con buena pinta.

Me puse manos a la obra y ví que efectivamente en la documentación oficial DMS permitía configurar s3 como [_source endpoint_](https://docs.aws.amazon.com/es_es/dms/latest/userguide/CHAP_Source.S3.html) y como [_target endpoint_](https://docs.aws.amazon.com/es_es/dms/latest/userguide/CHAP_Target.DynamoDB.html) dynamodb.

Ni que decir tiene, que este mismo proceso puede realizarse a la inversa y elegir dynamodb como fuente y s3 como destino, de ahí que en el título haya puesto _import/export_, pero me centraré en el _import_, ya que fue el origen de esta historia.

## Terraform

En aras de que todo este invento sea reutilizable y también que puedas eliminar todos los recursos que vas a crear una vez que ya no los necesites de forma sencilla, utilicé la conocida herramienta de infrastructura como código [terraform](https://www.terraform.io).

La primera vez, en realidad, lo hice porque para poder probar que todo funcionaba bien, lo hice en una cuenta de AWS que teníamos para pruebas y quería que fuese fácilmente exportable a la cuenta de producción donde luego lo usaríamos. Un paso inteligente por mi parte.

Tienes en mi repo de github todo el código terraform de ejemplo utilizado en este artículo para que lo descargues y lo apliques sobre la marcha: https://github.com/neovasili/dms-s3-import-to-dynamodb.

### Source endpoint

Configurar s3 como endpoint fuente, viene a ser algo como esto:
{% gist 559695e8e605a9b2ba900b8d917ca866 %}

Lo más destacado es la **estructura de tabla** (_external_table_definition_), que no es ni más ni menos que un fichero json que define la estructura de datos del csv. Por ejemplo:

{% ghcode https://github.com/neovasili/dms-s3-import-to-dynamodb/blob/master/files/extra_connection_attributes.json %}

En esta estructura caben destacar los atributos:
*  **TableName**. Como su nombre indica es el nombre de la tabla origen.
*  **TablePath**. DMS para funcionar con S3 requiere que los ficheros tengan un path mínimo específico, donde éste será: `schema_name/table_name` y de ahí el atributo anterior. Así, la estructura mínima que necesitas en tu bucket de S3 para que funcione con DMS es: `bucket_name/schema_name/table_name/*.csv`.

### Target endpoint

Éste es mucho más simple:

{% gist e6611f3300b32635600960617c3061fd %}

### Replication instance

A parte del nombre se pueden configurar cosas como la VPC en la que estará - sino se especifica se crea en la que te da AWS por defecto - el tamaño de disco, la versión del motor DMS de la instancia - yo usaría la última siempre que sea posible- si estará en multi-az o si estará accesible públicamente, entre otras cosas.

En este punto puedes elegir también el **tamaño de la instancia** de replicación. Por defecto aparece seleccionada una dms.t2.medium, pero puedes modificarla según te parezca. Hay que tener en cuenta también la [capa gratuita](https://aws.amazon.com/es/dms/free-dms/), sino, los precios están disponibles aquí: https://aws.amazon.com/es/dms/pricing/.

También es importante que consideres que cuanto mayor sea la instancia de replicación, mayor _throughput_ de red tendrás y por tanto más rápido podrás enviar datos a DynamoDB. Esto también está condicionado, obviamente, por la capacidad de escritura y lectura que le des a la tabla destino.

{% gist e258d7f23e22a69c7c66166ebf6fa0f0 %}

Ese _depends on_ del rol, a día de hoy, no funciona como se espera. Cuando empecé con esto, me di cuenta del problema que había y lo reporté, pero no parece que esté resuelto tal como puedes comprobar en el [hilo de la issue](https://github.com/hashicorp/terraform/issues/20346) y en [el que se generó](https://github.com/terraform-providers/terraform-provider-aws/issues/7748) a partir de éste.

El _workaround_ en este caso es tan sencillo como hacer `terraform apply` una vez - te dará error al crear la instancia de replicación - y volver a ejecutar `terraform apply` para que se creen todos los elementos que no se crearon en el primer paso.

Importante también, que el nombre de rol que va en ese _depends on_ tiene que tener un nombre específico y muy concreto: `dms-vpc-role`. Si por algún motivo, le pones otro nombre, cambias los guiones por guiones bajos o le añades algún tipo de prefijo/sufijo, aquello no funciona, así de simple.

### Replication task

Por último, la parte más importante, la tarea de replicación.

Básicamente, va a ser lo que conecta todas las piezas y pone tu proceso de importación en marcha. También se define el tipo de replicación a llevar a cabo. DMS te da tres tipos:
*  **Migrate existing data**. Una única carga masiva de datos desde el origen al destino. Es la que describo en este artículo.
*  **Migrate existing data and replicate ongoing changes**. Realiza una carga masiva inicial desde origen a destino y luego va replicando los cambios que vayan entrando. Acojonantemente útil.
*  **Replicate data changes only**. No realiza carga inicial, sólo replica entre origen y destino.

{% gist a9b3648dfad923e4a790f6f904ad1357 %}

Aquí, a parte de conectar los elementos antes descritos, tienes que considerar un par cosas:
*  **Ajustes** de la tarea de replicación. Fichero json con múltiples ajustes avanzados de la tarea. Lo que te puede interesar de esto es la definición del loggroup y logstream de cloudwatch -inicialmente tienen que estar vacíos, así que para setearlos debes hacerlo una vez creada la tarea - para que puedas llevar trazabilidad de lo que sucede en tus tareas de replicación.
*  **Mappings** de las tablas. Es decir, qué columnas corresponden desde el origen, con qué columnas en el destino. Por ejemplo:

{% ghcode https://github.com/neovasili/dms-s3-import-to-dynamodb/blob/master/files/table_mappings.json %}

Existe en DMS una versión GUI de este mapping, pero sinceramente a mi me parece más liosa que con el json, aunque también es cierto que existe poca documentación sobre la estructura de este json, así que _have it your way_ ;)

Lo que tienes que saber de este json es que en los dos primeros bloques se referencia a la "tabla" origen - recuerda que teníamos _schema_name_ y _table_name_ - y en el tercer bloque referenciamos al destino.

En este último bloque, además, es donde decimos qué atributos del origen - los que están referenciados con el doble dolar - corresponden con los del destino.

### Run and teardown

Una vez que ya tengas toda la infraestructura en marcha, y los ficheros .csv en su sitio, sólo tienes que arrancar la tarea de replicación bien desde la consola web de AWS o bien vía aws cli.

Cuando acabes tus tareas de replicación/importación/exportación, puedes prenderle fuego a todo con `terraform destroy`, pero has de tener en cuenta que **habrá un par de cosas que no se te van a eliminar**: los logs de cloudwatch y la tabla en DynamoDB de exclusiones.

Este último elemento lo crea DMS cuando se activa una tarea de replicación por primera vez. Se supone que DMS enviará ahí todo aquello que por el motivo que sea, no haya podido replicar del origen al destino.

Tras haber usado varias veces este procedimiento nunca se me ha enviado nada a esa tabla, pero entiendo que puede llegar a suceder. Tenlo en cuenta.

## Conclusions

Vale, ya sé que es un post largo y que parece bastante complejo, pero con estas indicaciones, en nada que lo uses una vez, verás que DMS es una herramienta muy potente, que soluciona un problema que puede parecer estúpido a simple vista, pero que sin embargo nos ahorra muchos dolores de cabeza y tiempo.

No recuerdo exactamente el tiempo que duró el proceso completo de importación con los datos reales, fueron unas pocas horas, pero sí recuerdo que la estimación que hicimos con el "proceso manual" se iba a más de una semana importando datos.

Para nuestro caso de uso usamos una instancia tipo dms.t2.large y subimos el aprovisionamiento de DynamoDB a 300 unidades de escritura y 1000 de lectura. Me gustaría en algún momento hacer más pruebas jugando con estos valores para comparar resultados.

DMS, a parte de los logs, también tiene un pequeño _dashboard_ que te permite monitorizar el proceso.

No pongo en duda la utilidad de la solución EMR + datapipeline, pero tengo claro que en este caso, esta solución es mucho más optima en cuanto a tiempos y a costes. Con DMS el único coste que se asumió fue el aprovisionamiento temporal de unidades de escritura y lectura de DynamoDB, que con datapipeline también hubiese sido necesario.

Infraestructura como código al poder. Al final, tuvimos que hacer algunos ajustes y realizar la importación completa de los datos un par de veces más. Fue increíblemente útil tenerlo todo preparado para con sólo tirar un par de comandos, dejarlo todo listo.

Tenía ganas de escribir este artículo y compartir contigo mi experiencia en este asunto. Por norma general, me gusta tocar los entresijos y conocer las tripas de los sistemas, soy bastante partidario del _do it yourself_ y de la _configuración sobre convención_, pero también de utilizar sistemas ya construídos si la solución es rentable. No podemos pretender saber de todo.

Gracias por llegar al final. Espero que te sea útil en algún momento ;)