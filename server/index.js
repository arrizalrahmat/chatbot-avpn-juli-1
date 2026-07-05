import {GoogleGenAI} from '@google/genai';
// di terminal jalankan npm install dotenv
import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import fs from 'fs/promises';
import cors from 'cors';

// const interaction = await ai.interactions.create({
//   model: model,
//   input: 'what is the capital of indonesia?',
// });
// console.log(interaction.output_text);
const model = process.env.MODEL;
const key = process.env.GEMINI_API_KEY;
console.log(key, '<<key');
const ai = new GoogleGenAI({
  apiKey: key,
});

const app = express();
const upload = multer();

const port = 3000;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('Hello Beruang!');
});

app.post('/generate-text', async (req, res) => {
  try {
    const {prompt} = req.body;
    console.log(prompt, '<<prompt');
    console.log(key, '<<key');

    const response = await ai.interactions.create({
      model: model,
      input: prompt,
    });

    res.status(200).json({
      output: response.output_text,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Error generating text');
  }
});

app.post(
  '/generate-from-document',
  upload.single('file'),
  async (req, res) => {
    try {
      const {prompt} = req.body;
      const fileBase64 = req.file.buffer.toString('base64');

      const response = await ai.models.generateContent({
        model: model,
        contents: [
          {
            text: prompt,
            type: 'text',
          },
          {
            inlineData: {
              data: fileBase64,
              mimeType: req.file.mimetype,
            },
          },
        ],
      });

      res.status(200).json({
        output: response.text,
      });
    } catch (error) {
      console.error(error);
      res.status(500).send('Error generating text');
    }
  },
);

app.post('/api/chat', async (req, res) => {
  try {
    const {conversation} = req.body;

    // validate if the conversation is an array
    if (!Array.isArray(conversation)) {
      throw new Error('Conversation must be an array');
    }

    // mapping conversation to the format required by Gemini API
    const contents = conversation.map(({role, text}) => ({
      role,
      parts: [{text}],
    }));

    const response = await ai.models.generateContent({
      model,
      contents,
      config: {
        temperature: 0.2, //reduce randomness in the output, because this is a company chatbot, we want to be more deterministic
        systemInstruction: `
        You are a helpful energetic, optimistic assistant for a company.
        do not answer any questions that are not related to the company. you will answer questions based on the company's knowledge base and provide accurate information.
        for a modern law firm, called e-legal. our company is based on Gedung Artha Graha, Jl. Jend. Sudirman kav 52-53 No.Kav 52-53, RT.5/RW.3, Senayan, Kebayoran Baru, South Jakarta City, Jakarta 12190
        our phone number is +62 82112348765.
        we are a young and modern law firm that focus on AI law consultation and we also provide attorney service for all matters. our company specialized in indonesian, singaporean, and malaysian law.
        You will answer questions based on the company's knowledge base and provide accurate information. If you don't know the answer, you will say "I don't know" instead of making up an answer.
        After each chat, you will always recommend the user to contact the company for further assistance. You will also provide the company's contact information at the end of each chat.
        `,
      },
    });

    res.status(200).json({
      output: response.text,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Error generating text');
  }
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
