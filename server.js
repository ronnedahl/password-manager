require('dotenv').config();  // Laddar miljövariabler från .env
const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const cors = require('cors')
console.log(`ENCRYPTION_KEY: "${process.env.ENCRYPTION_KEY}"`);
console.log('Längd:', process.env.ENCRYPTION_KEY.length);
const app = express();
app.use(bodyParser.json());
app.use(cors())

// För enkelhet använder vi en JSON-fil
// I en riktig applikation använd en databas
const DATA_FILE = path.join(__dirname, 'data.json');

// Läs in (eller initiera) datafil
function loadData() {
  if (!fs.existsSync(DATA_FILE)) {
    // Skapa fil om den inte finns
    fs.writeFileSync(DATA_FILE, JSON.stringify([]), 'utf-8');
  }
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
}

// Spara data till fil
function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

// Hämta krypteringsnyckel från .env
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default_key_32_chars_long'; // 32 tecken för AES-256
const IV_LENGTH = 16; // Blockstorlek för AES
console.log(`ENCRYPTION_KEY: "${process.env.ENCRYPTION_KEY}"`);
console.log('Längd:', process.env.ENCRYPTION_KEY.length);


// Krypteringsfunktion
function encrypt(text) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'utf8'), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

// Dekrypteringsfunktion
function decrypt(text) {
  const textParts = text.split(':');
  const iv = Buffer.from(textParts.shift(), 'hex');
  const encryptedText = textParts.join(':');
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'utf8'), iv);
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// Endpoint för att hämta alla sparade konton (med dekrypterade lösenord)
app.get('/api/passwords', (req, res) => {
  const data = loadData();
  // Dekryptera varje lösenord innan vi skickar tillbaka
  const decryptedData = data.map(item => ({
    username: item.username,
    site: item.site,
    password: decrypt(item.password)
  }));
  res.json(decryptedData);
});

// Endpoint för att spara nytt konto/lösenord
app.post('/api/passwords', (req, res) => {
  const { username, site, password } = req.body;

  if (!username || !site || !password) {
    return res.status(400).json({ error: 'username, site och password krävs' });
  }

  const data = loadData();
  // Kryptera lösenordet innan sparning
  const encryptedPassword = encrypt(password);

  data.push({ username, site, password: encryptedPassword });
  saveData(data);

  res.json({ message: 'Lösenord sparat!' });
});

// Endpoint för att ta bort ett lösenord
app.delete('/api/passwords/:index', (req, res) => {
    try {
      const index = parseInt(req.params.index);
      const data = loadData();
      
      if (index >= 0 && index < data.length) {
        data.splice(index, 1);
        saveData(data);
        res.json({ message: 'Lösenord borttaget!' });
      } else {
        res.status(404).json({ error: 'Lösenord hittades inte' });
      }
    } catch (error) {
      res.status(500).json({ error: 'Serverfel vid borttagning av lösenord' });
    }
  });


// Starta servern
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server körs på http://localhost:${PORT}`);
});
