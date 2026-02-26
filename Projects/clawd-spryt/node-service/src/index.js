const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

const PORT = 3001;
const PYTHON_SERVICE = 'http://localhost:5002';

// Logging middleware
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
});

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'node',
        port: PORT
    });
});

// AI Chat - forwards to Python service
app.post('/api/ai/chat', async (req, res) => {
    try {
        const { prompt, temperature = 0.7 } = req.body;
        
        if (!prompt) {
            return res.status(400).json({ error: 'No prompt provided' });
        }
        
        console.log(`Forwarding to Python service: ${prompt.substring(0, 50)}...`);
        
        const response = await axios.post(
            `${PYTHON_SERVICE}/api/generate`,
            { prompt, temperature },
            { timeout: 30000 }
        );
        
        res.json(response.data);
        
    } catch (error) {
        console.error('Error calling Python service:', error.message);
        res.status(500).json({
            error: 'Failed to process request',
            details: error.message
        });
    }
});

// Workflow - calls Python for analysis
app.post('/api/workflow/analyze', async (req, res) => {
    try {
        const { data } = req.body;
        
        if (!data) {
            return res.status(400).json({ error: 'No data provided' });
        }
        
        // Ask AI to analyze the data
        const analysisPrompt = `Analyze this data and provide insights: ${JSON.stringify(data)}`;
        
        const response = await axios.post(
            `${PYTHON_SERVICE}/api/generate`,
            { prompt: analysisPrompt, temperature: 0.3 },
            { timeout: 30000 }
        );
        
        res.json({
            success: true,
            analysis: response.data.content,
            data: data
        });
        
    } catch (error) {
        console.error('Workflow error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Start server
app.listen(PORT, '127.0.0.1', () => {
    console.log(`Node.js service listening on http://127.0.0.1:${PORT}`);
    console.log('Ready to route requests to Python service');
});
