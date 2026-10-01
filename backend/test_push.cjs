const fetch = require('node-fetch');

async function testPush() {
    try {
        const res = await fetch('https://admin-v2-backend.onrender.com/api/send-notification', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                earner_id: 'NOVAIRA/INDIVIDUAL/D54B7FA', // Helo Bro from earlier
                title: 'Test',
                body: 'Test',
                type: 'wallet'
            })
        });
        const text = await res.text();
        console.log("Status:", res.status);
        console.log("Response:", text);
    } catch(e) {
        console.log("Fetch error:", e);
    }
}
testPush();
