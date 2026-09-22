const cloudinary = require('cloudinary').v2;
cloudinary.config({ cloud_name: 'dwflw21ib', api_key: '236244777636517', api_secret: 'OKMxHQk7eWBkBdxXpix-IoabN2I' });

async function testDelete() {
    try {
        const res1 = await cloudinary.api.delete_resources_by_prefix('DEMO_VIDEOS/');
        console.log("Deleted resources:", res1);
        const res2 = await cloudinary.api.delete_folder('DEMO_VIDEOS');
        console.log("Deleted folder:", res2);
    } catch(e) {
        console.log("Error:", JSON.stringify(e));
    }
}
testDelete();
