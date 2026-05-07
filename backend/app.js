const express = require("express");
const cors = require("cors");
const browse = require('./routes/Rbrowse');
const trait = require('./routes/Rtrait');
const app = express();


app.use(cors());
app.use(express.json());

// 路由
app.use(browse);
app.use(trait);

// 启动服务
const PORT = 4000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});




