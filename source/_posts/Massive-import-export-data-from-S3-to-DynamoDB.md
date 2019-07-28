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

Para empezar quería escribir al menos un post explicando cómo había sido esto de crear un blog serverless, pero lo cierto es que me apetecía escribir primero este post. Hace algún tiempo que lo tengo en mente.

Esta es una de esas historias que se escriben solas.

Prácticamente el primer día en la ofi. Me siento, y a los pocos minutos cuando aún no había casi ni configurado la cuenta del correo corporativo, un compañero me hace una pregunta: 


**Compitrueno** - _"oye, me han dicho que esto de Amazon, tu controlas, ¿no?"_

**Yo** - _"bueno, algo sé"_ - la prudencia al poder -

**Compitrueno** - _"es que verás, tenemos un proyecto en el que estoy trabajando, que tenemos que cargar en una tabla de dynamodb un montón de datos"_ - un csv o datos que podían llevarse fácilmente a un csv - _"y lo estamos haciendo con el SDK de 25 en 25, pero me da que esto va muy lento, ¿sabes si hay alguna otra forma de hacerlo que sea más rápida?"_

**Yo** - Curiosamente, había estado hace pocas semanas preparando la certificación de Big data de AWS - que suspendí como un campeón - y me sonaba que había algo. _"Sí, me suena que hay algo para hacerlo de forma masiva. Déjame un rato a ver si lo encuentro y te digo"_.
<!-- more -->

Efectivamente, con una simple búsqueda, localicé algunos enlaces entre los que estaba uno de la propia documentación oficial de AWS que se hacía usando datapipeline. Se lo comenté a mi compi, y me dijo que no era necesario todavía, así que el tema se quedó ahí y lo retomamos más adelante.

**TL;DR** Clonar repositorio y leer el readme ;)
```bash
git clone https://github.com/neovasili/dms-s3-import-to-dynamodb.git
```

## Discovery phase

Siendo una solución de la propia AWS, confié en que sería lo más óptimo y probablemente la más sencilla de implementar (sí, me he leído, a veces parece que no he aprendido nada con el paso de los años...), así que me puse a ello.

De las primeras cosas que me empezaron a chirriar fue que **datapipeline**, aunque tenía soporte nativo para s3 y dynamodb, por debajo, se levanta un cluster de **EMR** (AWS Elastic Map Reduce), algo que así de primeras, se me antojaba excesivo para nuestro caso de uso. No obstante, tenía sentido, si lo que íbamos a importar era una gran cantidad de datos.

Aunque los había estudiado, era la primera vez que usaba ambos servicios, así que al principio no entendía muy bien cómo funcionaban. Leí algo de documentación y encontré algún esquema que me aclaró un poco más el tema. Acto seguido, me puse a "catarlo".

Segunda cosa que me chirriaba. El invento, tardaba casi 30 minutos sólo en levantarse y otros 15 en morir algo que, por otra parte, era lógico teniendo en cuenta que el cluster tenía tres nodos bastante tochos con mucha fontanería que no me apetecía entender demasiado. Esto iba a suponer un coste importante si se tenía que mantener levantado mucho rato, pero se suponía que iba a ser una sola carga (iluso de mí) y que con toda esa potencia no iba a llevar mucho tiempo.

Y tanto. El proceso de importación con un fichero de pruebas de 120 mil tuplas, a penas llevaba 15 o 20 segundos, pero petaba como una palomita. Lo peor, es que no veía de forma clara dónde estaba el pete y al tercer intento, se me empezaron a hinchar las venas del cráneo y pensé que tenía que haber algo más simple que pudiera servir también.

## DMS

Rebuscando en los avernos encontré [un post del blog oficial de AWS](https://aws.amazon.com/es/blogs/database/migrate-delimited-files-from-amazon-s3-to-an-amazon-dynamodb-nosql-table-using-aws-database-migration-service-and-aws-cloudformation/) que decía que se podía usar **AWS Database Migration Service** (DMS) para utilizar como fuente s3 y destino dynamodb. Así que parecía que había otra alternativa con buena pinta.

Me puse manos a la obra y ví que efectivamente en la documentación oficial DMS permitía configurar s3 como [_source endpoint_](https://docs.aws.amazon.com/es_es/dms/latest/userguide/CHAP_Source.S3.html) además de las configuraciones necesarias y como [_target endpoint_](https://docs.aws.amazon.com/es_es/dms/latest/userguide/CHAP_Target.DynamoDB.html) dynamodb.

Ni que decir tiene, que este mismo proceso puede realizarse a la inversa y elegir dynamodb como fuente y s3 como destino, de ahí que en el título haya puesto _import/export_, pero me centraré en el _import_, ya que fue el origen de esta historia.

### Source endpoint

Para configurar s3 como endpoint fuente, necesitas lo siguiente:
*  **Identificador** del punto de enlace, un nombre, vaya.
*  **Motor** de origen: S3.
*  ARN de **rol de acceso al servicio**. Hay que crear un rol específico con los permisos necesarios para que DMS pueda operar con S3 o usar uno de los gestionados por AWS.
*  Nombre del **bucket** de S3 donde estarán los ficheros csv, puede haber N ficheros.
*  **Estructura** de tabla. Fichero json que define la estructura de datos del csv. Por ejemplo:

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
          "ColumnName": "name_value",
          "ColumnType": "STRING",
          "ColumnNullable": "false",
          "ColumnLength": "20"
        }
      ],
      "TableColumnsTotal": "2"
    }
  ]
}
```

En esta estructura caben destacar los atributos:
*  **TableName**. Como su nombre indica es el nonbre de la tabla origen.
*  **TablePath**. DMS para funcionar con S3 requiere que los ficheros tengan un path mínimo específico, donde éste será: `schema_name/table_name` y de ahí el atributo anterior. Así, la estructura mínima que necesitas en tu bucket de S3 para que funcione con DMS es: `bucket_name/schema_name/table_name/*.csv`.

Además de estos atributos básicos, es posible definir otros atributos adicionales de conexión bastante interesantes:
*  **bucketFolder**. Si los ficheros csv están dentro de una "carpeta" determinada en el bucket, es posible definir la ruta completa. Puede ser útil si ya tienes los ficheros ahí y no quieres moverlos para cumplir con la estructura base que te pide DMS
*  **csv_delimiter**. Carácter delimitador para las columnas en el csv. Lo típico es que vaya con comas o punto y coma, pero podemos modificarlo por otro. En mi caso utilicé pipes "|" ya que los otros podían encontrarse por ahí y podía provocar que las "columnas" del csv se cortaran por donde no debían.
*  **csv_row_delimiter**. Carácter delimitador para las filas en el csv. Lo normal será usar "\n", pero podría suceder que por el origen de los datos fuera distinto.

### Target endpoint

Éste es mucho más simple:
*  **Identificador** del punto de enlace. Nombre que le pones al endpoint.
*  **Motor** de origen: dynamodb
*  ARN de **rol de acceso** al servicio.

Aunque he dicho que es más simple, aquí empieza la diversión. Éste útlimo rol no sólo necesita unos permisos específicos sino que además, aunque AWS te obliga a que lo crees tu, tiene que tener un nombre específico y muy concreto: `dms-vpc-role`. Si por algún motivo, le pones otro nombre, cambias los guiones por guiones bajos o le añades algún tipo de prefijo/sufijo, aquello no funciona, así de simple.

### Replication instance

Es la parte más sencilla de configurar. Basta con crear un elemento de la misma. El único campo a rellenar es el nombre, el resto se pueden dejar por defecto, aunque se pueden configurar cosas como la VPC en la que estará - sino se especifica se crea en la que te da AWS por defecto - el tamaño de disco, la versión del motor DMS de la instancia - yo usaría la última siempre que sea posible- si estará en multi-az o si estará accesible públicamente, entre otras cosas.

En este punto podemos elegir también el **tamaño de la instancia** de replicación. Por defecto aparece seleccionada una dms.t2.medium, pero podemos modificarla según necesitemos. Hay que tener en cuenta también la [capa gratuita](https://aws.amazon.com/es/dms/free-dms/), sino los precios están disponibles aquí: https://aws.amazon.com/es/dms/pricing/.

También es importante que consideres que cuanto mayor sea la instancia de replicación, mayor _throughput_ de red tendrás y por tanto más rápido podrás enviar datos a DynamoDB. Esto también está condicionado, obviamente, por la capacidad de escritura y lectura que le des a la tabla destino.

### Replication task

Por último, la parte más importante, la tarea de replicación.

Básicamente, va a ser lo que conecta todas las piezas y pone tu proceso de importación en marcha. También se define el tipo de replicación a llevar a cabo. DMS te da tres tipos:
*  **Migrate existing data**. Una única carga masiva de datos desde el origen al destino. Es la que describo en este artículo.
*  **Migrate existing data and replicate ongoing changes**. Realiza una carga masiva inicial desde origen a destino y luego va replicando los cambios que vayan entrando. Acojonantemente útil.
*  **Replicate data changes only**. No realiza carga inicial, sólo replica entre origen y destino.

Aquí, a parte de conectar los elementos antes descritos, tienes que considerar un par cosas:
*  **ID de la tarea**. Capitán obvio ataca de nuevo.
*  **Ajustes** de la tarea de replicación. Fichero json con múltiples ajustes avanzados de la tarea. Aquí lo que te puede interesar es la definición del loggroup y logstream de cloudwatch -inicialmente tienen que estar vacíos, así que para setearlos debes hacerlo una vez creada la tarea - para que puedas llevar trazabilidad de lo que sucede en tus tareas de replicación.
*  **Mappings** de las tablas. Es decir, qué columnas corresponden desde el origen, con qué columnas en el destino. Por ejemplo:

```json
{
  "rules": [
    {
      "rule-type": "selection",
      "rule-id": "1",
      "rule-name": "1",
      "object-locator": {
        "schema-name": "import",
        "table-name": "test"
      },
      "rule-action": "include"
    },
    {
      "rule-type": "object-mapping",
      "rule-id": "2",
      "rule-name": "2",
      "rule-action": "map-record-to-record",
      "object-locator": {
        "schema-name": "import",
        "table-name": "test"
      },
      "target-table-name": "test",
      "mapping-parameters": {
        "partition-key-name": "id",
        "attribute-mappings": [
          {
            "target-attribute-name": "id",
            "attribute-type": "scalar",
            "attribute-sub-type": "string",
            "value": "$${id}"
          },
          {
            "target-attribute-name": "name_value",
            "attribute-type": "scalar",
            "attribute-sub-type": "string",
            "value": "$${name_value}"
          }
        ]
      }
    }
  ]
}
```

Existe en DMS una versión GUI de este mapping, pero sinceramente a mi me parece más liosa que con el json, aunque también es cierto que existe poca documentación sobre la estructura de este json, así que _have it your way_ ;)

Lo que tenéis que saber de este json es que en los dos primeros bloques se referencia a la "tabla" origen - recordad que teníamos _schema_name_ y _table_name_ - y en el tercer bloque referenciamos al destino.

En este último bloque, además, es donde decimos qué atributos del origen - los que están referenciados con el doble dolar - corresponden con los del destino.

## Terraform

En aras de que todo este invento sea reutilizable y también que puedas eliminar todos los recursos que vas a crear una vez que ya no los necesites de forma sencilla, utilicé la conocida herramienta de infrastructura como código [terraform](https://www.terraform.io).

La primera vez, en realidad, lo hice porque para poder probar que todo funcionaba bien, lo hice en una cuenta de AWS que teníamos para pruebas y quería que fuese fácilmente exportable a la cuenta de producción donde luego lo usaríamos. Un paso inteligente por mi parte.

Tienes en mi repo de github todo el código terraform de ejemplo utilizado en este artículo para que lo descargues y lo apliques sobre la marcha: https://github.com/neovasili/dms-s3-import-to-dynamodb.

No obstante, te pongo aquí la parte de DMS, que es la más divertida. Voy a ir describiendo del mismo modo que en el resto del artículo.

### Source endpoint

```hcl
resource "aws_dms_endpoint" "origin" {
  endpoint_id   = var.source_endpoint_id
  endpoint_type = "source"
  engine_name   = "s3"

  s3_settings {
    bucket_folder             = ""
    bucket_name               = aws_s3_bucket.dynamodb_import_bucket.bucket
    compression_type          = "NONE"
    csv_delimiter             = var.csv_delimiter
    csv_row_delimiter         = var.csv_row_delimiter
    external_table_definition = data.template_file.extra_connection_attributes.rendered

    service_access_role_arn = aws_iam_role.dms_vpc_role.arn
  }
}
```