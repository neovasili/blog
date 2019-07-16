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

Para empezar quería escribir al menos un post explicando cómo había sido esto de crear un blog serverless, pero lo cierto es que me apetecía escribir primero este post.

Esta es una de esas historias que se escriben solas.

Prácticamente el primer día en la ofi. Me siento, y a los pocos minutos cuando aún no había casi ni configurado la cuenta del correo corporativo, un compañero me hace una pregunta: 


**Compitrueno** - _"oye, me han dicho que esto de Amazon, tu controlas, ¿no?"_

**Yo** - _"bueno, algo sé" - la prudencia al poder -_

**Compitrueno** - _"es que verás, tenemos un proyecto en el que estoy trabajando, que tenemos que cargar en una tabla de dynamodb un montón de datos" - un csv o datos que podían llevarse fácilmente a un csv - "y lo estamos haciendo con el SDK de 25 en 25, pero me da que esto va muy lento, ¿sabes si hay alguna otra forma de hacerlo que sea más rápida?"_

**Yo** - Curiosamente, había estado hace pocas semanas preparando la certificación de Big data de AWS - que suspendí como un campeón - y me sonaba que había algo. _"Sí, me suena que hay algo para hacerlo de forma masiva. Déjame un rato a ver si lo encuentro y te digo"_.
<!-- more -->

Efectivamente, con una simple búsqueda, localicé algunos enlaces entre los que estaba uno de la propia documentación oficial de AWS que se hacía usando datapipeline. Se lo comenté a mi compi, y me dijo que no era necesario todavía, así que el tema se quedó ahí y lo retomamos más adelante.

## Discovery phase

Siendo una solución de la propia AWS, confié en que sería lo más óptimo y probablemente la más sencilla de implementar (sí, me he leído, a veces parece que no he aprendido nada con el paso de los años...), así que me puse a ello.

De las primeras cosas que me empezaron a chirriar fue que **datapipeline**, aunque tenía soporte nativo para s3 y dynamodb, por debajo, se levanta un cluster de **EMR** (AWS Elastic Map Reduce), algo que así de primeras, se me antojaba excesivo. No obstante, tenía sentido, si lo que íbamos a importar era una gran cantidad de datos.

Aunque los había estudiado, era la primera vez que usaba ambos servicios, así que al principio no entendía muy bien cómo funcionaban. Leí algo de documentación y encontré algún esquema que me aclaró un poco más el tema. Acto seguido, me puse a "catarlo".

Segunda cosa que me chirriaba. El invento, tardaba casi 30 minutos sólo en levantarse y otros 15 en morir algo que, por otra parte, era lógico teniendo en cuenta que el cluster tenía tres nodos bastante tochos con mucha fontanería que no me apetecía entender demasiado. Esto iba a suponer un coste importante si se tenía que mantener levantado mucho rato, pero se suponía que iba a ser una sola carga (iluso de mí) y que con toda esa potencia no iba a llevar mucho tiempo.

Y tanto. El proceso de importación con un fichero de pruebas de 120 mil tuplas, a penas llevaba 15 o 20 segundos, pero petaba como una palomita. Lo peor, es que no veía de forma clara dónde estaba el pete y al tercer intento, se me empezaron a hinchar las venas del cráneo y pensé que tenía que haber algo más simple que pudiera servir también.

## DMS

Rebuscando en los avernos encontré [un post del blog oficial de AWS](https://aws.amazon.com/es/blogs/database/migrate-delimited-files-from-amazon-s3-to-an-amazon-dynamodb-nosql-table-using-aws-database-migration-service-and-aws-cloudformation/) que decía que se podía usar **AWS Database Migration Service** (DMS) para utilizar como fuente s3 y destino dynamodb. Así que parecía que había otra alternativa con buena pinta.

Me puse manos a la obra y ví que efectivamente en la documentación oficial DMS permitía configurar s3 como [_source endpoint_](https://docs.aws.amazon.com/es_es/dms/latest/userguide/CHAP_Source.S3.html) además de las configuraciones necesarias y como [_target endpoint_](https://docs.aws.amazon.com/es_es/dms/latest/userguide/CHAP_Target.DynamoDB.html) dynamodb.

Ni que decir tiene, que este mismo proceso puede realizarse a la inversa y elegir dynamodb como fuente y s3 como destino, de ahí que en el título haya puesto _import/export_, pero me centraré en el _import_, ya que fue el origen de esta historia.

### Source endpoint

Para configurar s3 como endpoin fuente, necesitas lo siguiente:
*  **Identificador** del punto de enlace, un nombre, vaya.
*  **Motor** de origen: S3.
*  ARN de **rol de acceso al servicio**. Hay que crear un rol específico con los permisos necesarios para que DMS pueda operar con S3 o usar uno de los gestionados por AWS.
*  Nombre del **bucket** de S3 donde estarán los ficheros csv, puede haber N ficheros.
*  **Estructura** de tabla. Fichero json que define la estructura de datos del csv.

```json
{
  "TableCount": "1",
  "Tables": [
    {
      "TableName": "test",
      "TablePath": "import/test/",
      "TableOwner": "import",
      "TableColumns": [
        {
          "ColumnName": "id",
          "ColumnType": "STRING",
          "ColumnNullable": "false",
          "ColumnIsPk": "true",
          "ColumnLength": "25"
        },
        {
          "ColumnName": "value",
          "ColumnType": "INT8",
          "ColumnLength": "1"
        }
      ],
      "TableColumnsTotal": "2"
    }
  ]
}
```

Además de estos atributos básicos, es posible definir otros atributos adicionales de conexión bastante interesantes:
*  **bucketFolder**. Si los ficheros csv están dentro de una "carpeta" determinada en el bucket, es posible definir la ruta completa. Puede ser útil si ya tienes los ficheros ahí y no quieres moverlos para cumplir con la estructura base que te pide DMS