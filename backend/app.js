require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const express = require("express");
const cors = require("cors");
const browse = require('./routes/Rbrowse');
const trait = require('./routes/Rtrait');
const program = require('./routes/Rprogram');
const regulation = require('./routes/Rregulation');
const dataRoute = require('./routes/Rdata');
const app = express();

app.use(cors());
app.use(express.json());

app.use(browse);
app.use(trait);
app.use(program);
app.use(regulation);
app.use(dataRoute);

// 启动服务
const PORT = 4000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});




