const http = require('http');
const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://mongodb:27017';

// Funzione per leggere i dati inviati dal form (POST)
const parseBody = (req) => {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      const params = new URLSearchParams(body);
      const data = {};
      for (const [key, value] of params.entries()) {
        data[key] = value;
      }
      resolve(data);
    });
  });
};

const server = http.createServer(async (req, res) => {
  
  // 1. Gestione dell'immagine statica (il wow.jpg)
  if (req.url === '/wow.jpg') {
    const imagePath = path.join(__dirname, '../immagini/wow.jpg');
    fs.readFile(imagePath, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end('Immagine non trovata');
      } else {
        res.writeHead(200, { 'Content-Type': 'image/jpg' });
        res.end(data);
      }
    });
    return;
  }

  let client;
  try {
    client = new MongoClient(MONGO_URI);
    await client.connect();
    const db = client.db('app_db');
    const collection = db.collection('entries');

    // 2. SALVATAGGIO DATI (POST)
    if (req.method === 'POST' && req.url === '/save') {
      const formData = await parseBody(req);
      await collection.insertOne({ 
        messaggio: formData.messaggio, 
        createdAt: new Date() 
      });
      await client.close();

      // Ritorna alla home dopo il salvataggio
      res.writeHead(302, { 'Location': '/' });
      res.end();
      return;
    }

    // 3. VISUALIZZAZIONE PAGINA HTML + DATI DA MONGO (GET)
    if (req.method === 'GET' && req.url === '/') {
      const items = await collection.find({}).sort({ createdAt: -1 }).toArray();
      await client.close();

      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`
        <!DOCTYPE html>
        <html lang="it">
        <head>
          <meta charset="UTF-8">
          <title>DevOps App</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 600px; margin: 40px auto; padding: 0 20px; background: #f4f4f9; }
            .card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 20px; }
            img { display: block; max-width: 120px; margin-bottom: 15px; }
            input[type="text"] { width: 70%; padding: 8px; margin-right: 10px; }
            button { padding: 8px 15px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; }
            ul { padding-left: 20px; }
            li { margin-bottom: 8px; color: #333; }
          </style>
        </head>
        <body>
          <div class="card">
            <img src="/wow.jpg" alt="wow">
            <h2>Inserisci un nuovo record</h2>
            <form action="/save" method="POST">
              <input type="text" name="messaggio" placeholder="Scrivi un messaggio vedrai che succede qualcosa ;)" required>
              <button type="submit">cliccami!</button>
            </form>
          </div>

          <div class="card">
            <h3>Storico salvato in MongoDB così non ci dimentichiamo</h3>
            <ul>
              ${items.length === 0 ? '<li>Nessun dato presente. scrivici qualcosa...</li>' : items.map(i => `<li><b>${i.messaggio}</b> <small style="color:gray;">(${new Date(i.createdAt).toLocaleTimeString()})</small></li>`).join('')}
            </ul>
          </div>
        </body>
        </html>
      `);
      return;
    }

    await client.close();
    res.writeHead(404);
    res.end('Not Found');

  } catch (err) {
    if (client) await client.close();
    res.writeHead(500);
    res.end(`Errore server: ${err.message}`);
  }
});

server.listen(PORT, () => {
  console.log(`Server avviato sulla porta ${PORT}`);
});