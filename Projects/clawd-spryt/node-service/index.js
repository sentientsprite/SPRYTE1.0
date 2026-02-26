const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

const PORT = 3000;
const PYTHON_SERVICE = 'http://localhost:5000';

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'node',
        port: PORT
    });
});

// Gateway to Python service
app.post('/api/gateway/generate', async (req, res) => {
    try {
        const { prompt } = req.body;
        
        if (!prompt) {
            return res.status(400).json({ error: 'No prompt provided' });
        }
        
        console.log(`Forwarding to Python service: ${prompt}`);
        
        const response = await axios.post(
            `${PYTHON_SERVICE}/api/generate`,
            { prompt },
            { timeout: 60000 }
        );
        
        res.json({
            success: true,
            source: 'node-gateway',
            data: response.data
        });
        
    } catch (error) {
        console.error('Gateway error:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

app.listen(PORT, '127.0.0.1', () => {
    console.log(`Node.js service running on port ${PORT}`);
    console.log(`Forwarding to Python service at ${PYTHON_SERVICE}`);
});
