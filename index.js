const express = require('express');
const app = express();
const cors = require('cors');
const { MongoClient } = require("mongodb");
const admin = require("firebase-admin");
require('dotenv').config();
const ObjectId = require('mongodb').ObjectId;
const stripe = require('stripe')(process.env.STRIPE_SECRET)

const port = process.env.PORT || 5000;

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// middleware
app.use(cors())
app.use(express.json())


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.mthak.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

async function verifyToken(req, res, next){
    if(req.headers?.authorization?.startsWith('Bearer ')){
        const token = req.headers.authorization.split(' ')[1];

        try{
            const decodedUser = await admin.auth().verifyIdToken(token);
            req.decodedEmail = decodedUser.email;
        }
        catch{

        }
    }
    next();
}
async function run () {
 try{
     await client.connect();
     const database = client.db('doctors_db');
     const appointCollection = database.collection('appointments')
     const usersCollection = database.collection('users');

     // appointments GET
     app.get('/appointments', verifyToken, async(req, res) => {
         const email = req.query.email;
         const date = req.query.date;
         const query = {email: email, date: date}
         const cursor = appointCollection.find(query);
         const appointments = await cursor.toArray();
         console.log(appointments)
         res.json(appointments); 
     })
     // Get single Data
     app.get('/users/:email', async(req, res) => {
         const email = req.params.email;
         const query = {email: email};
         const user = await usersCollection.findOne(query);
         let isAdmin = false;
         if(user?.role == 'admin'){
             isAdmin = true;
         }
         res.json({admin: isAdmin})
     })

     // Payment by id
     app.get('/appointments/:id', async(req, res) => {
        const id = req.params.id;
        const query = {_id: ObjectId(id)};
        const  result = await appointCollection.findOne(query);
        res.json(result);
     })

     // appointments POST
     app.post('/appointments', async(req, res) => {
        const appointment = req.body;
        const result = await appointCollection.insertOne(appointment)
        res.json(result)
     })

    // UPdate appointments info by payments
    app.put('/appointments/:id', async(req, res) => {
        const id = req.params.id;
        const payment = req.body;
        const filter = {_id: ObjectId(id)};
        const updateDoc = {
            $set: {
                payment: payment
            }
        };
        const result = await appointCollection.updateOne(filter, updateDoc);
        res.json(result);
    })

     //Users POST
     app.post('/users', async(req, res) => {
         const user = req.body;
         const result = await usersCollection.insertOne(user);
         res.json(result);
     })
     //Upsert
     app.put('/users', async(req, res) => {
        const user = req.body;
        const filter = {email: user.email};
        const options = {upsert: true};
        const updateDoc = {$set: user};
        const result = await usersCollection.updateOne(filter, updateDoc, options);
        res.json(result);
     })
     // (Add/Admin) - update user
     app.put('/users/admin', verifyToken, async(req, res) => {
        const user = req.body;
        const requester = req.decodedEmail;
        if(requester){
            const requesterAccount = await usersCollection.findOne({email: requester});
            if(requesterAccount.role === 'admin'){
                const filter = {email: user.email};
                const updateDoc = {$set:{role:'admin'}};
                const result = await usersCollection.updateOne(filter, updateDoc);
                res.json(result);
            }
        }
        else{
            res.status(403).json({message: 'You do not have access to make an Admin'})
        }
        
     })
     // User Payment info
     app.post('/create-payment-intent', async(req, res) => {
         const paymentInfo = req.body;
         const amount = paymentInfo.price*100;
         const paymentIntent = await stripe.paymentIntents.create({
            currency: 'usd',
            amount: amount,
            payment_method_types: ['card']
         })
         res.json({clientSecret:paymentIntent.client_secret})
     })

 }
 finally{
     //await client.close();
 }
}
run().catch(console.dir)


app.get('/', (req, res) => {
    res.send('My Doctors server is Running')
})

app.listen(port, () => {
    console.log('Doctors Server running port:', port)
})

/*
app.get('/users')
app.post('/users')
app.get('/users/:id')
app.put('/users/:id')
app.delete('/users/:id')

users:get;=(get all user or one user or filter user)
users:get('/users/id')
users: post=(post one user or create one user)
users:delete()
*/