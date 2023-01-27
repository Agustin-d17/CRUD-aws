const express = require('express');
const AWS = require('aws-sdk');
const { response } = require('express');
const { error } = require('console');

AWS.config.update({
    region: 'us-east-1',
});

const sns = new AWS.SNS()
//ARN que provee la app
const SNS_TOPIC_ARN = 'arn:aws:sns:us-east-1:328026125510:notificaciones:71fe7e7c-795d-4fc9-bffb-21785e9ed9b6'

const dynamoDB = new AWS.DynamoDB.DocumentClient();
//Nombre de la tabla creada
const TABLE_NAME = 'product-inventory' 

const app = express();
app.use(express.json())

app.get('/', (req, res) => {
    res.send('Test-api')
})

app.get('/api/products', async (req, res) => {
    const params = {
        TableName: TABLE_NAME
    }

    try{
        const products = await scanDynamoRecords(params)
        res.json(products)
    } catch(err){
        console.error(`ocurrio un error ${err}`)
        res.status(500)
    }
})

//Funcion scanDynamoRecords
async function scanDynamoRecords(scanParams) {
    try {
        let dynamoData = await dynamoDB.scan(scanParams).promise()
        const items = dynamoData.Items
        while (dynamoData.LastEvaluatedKey) {
            scanParams.ExclusiveKey = dynamoData.LastEvaluatedKey
            items.push(...dynamoData.items)
        }

        return items
    } catch (error) {
        throw new Error(error)
    }
}

app.post('/api/productos', async (req, res) => {
    const params = {
        TableName: TABLE_NAME,
        Item: req.body
    }

    dynamoDB.put(params).promise()
    .then(() => {
        console.log('Se guardo')
        const prod = JSON.stringify(req.body)
        return sns.publish({
            Message: 'Nuevo producto agregado',
            Subject: 'Nuevo Producto',
            TopicArn: SNS_TOPIC_ARN
        }).promise()
    })
    .then(data => {
        console.log('Se notifico')
        console.log(data)

        const body = {
            Operation: 'SAVE',
            Message: 'SUCCESS',
            Item: req.body
        }
        res.json(body)
    })
    .catch(err => {
        console.error(`Ocurrio un error, ${err}`)
        res.status(500).end()
    })
})

app.put('/api/productos/:id', (req, res) => {
    const item = {
        ...req.body, 
        productId: req.params.id
    }

    const params = {
        TableName: TABLE_NAME,
        Item: item
    }

    dynamoDB.put(params).promise()
    .then(() => {
        const body = {
            Operation: 'UPDATE',
            Message: 'SUCCESS',
            Item: item
        }
        res.json(body)
    })
    .catch(error => {
        console.error(`Ocurrio un error ${error}}`)
        res.sendStatus(500)
    })
})

app.delete('/api/productos/:id', (req, res) => {
    const params = {
        TableName: TABLE_NAME,
        Key: {
            'productId': req.params.id
        },
        ReturnValues: 'ALL_OLD'
    }

    dynamoDB.delete(params).promise()
    .then(response => {
        const body = {
            operation: 'DELETE',
            Message: 'SUCCESS',
            Item: response
        }

        res.json(body)
    })
    .catch(error => {
        console.error(`Ocurrio un error ${error}`)
        res.sendStatus(500)
    })
})

const PORT = process.env.PORT || 8080

const server = app.listen(PORT, () => {
    console.log(`Server listening on port: ${PORT}`)
})

server.on('error', (err) => {
    console.log(`Error: ${err}`)
})




