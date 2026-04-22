const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 数据存储路径
const DATA_DIR = path.join(__dirname, 'data');
const PRICES_FILE = path.join(DATA_DIR, 'prices.json');

// 确保数据目录存在
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// 初始化数据文件
if (!fs.existsSync(PRICES_FILE)) {
    fs.writeFileSync(PRICES_FILE, '[]');
}

// 商户白名单
let merchants = [];
try {
    const merchantsData = fs.readFileSync(path.join(__dirname, 'public', 'merchants.json'), 'utf8');
    merchants = JSON.parse(merchantsData);
    console.log(`✅ 已加载 ${merchants.length} 户商户白名单`);
} catch (error) {
    console.error('❌ 加载商户白名单失败:', error);
}

// 产品列表（按固定顺序）
const products = [
    { id: 'p1', name: '黄金叶（天叶细支3mg）' },
    { id: 'p2', name: '中华（细支3mg）' },
    { id: 'p3', name: '黄金叶（软天叶）' },
    { id: 'p4', name: '利群（休闲细支）' },
    { id: 'p5', name: '黄金叶（天叶细支）' },
    { id: 'p6', name: '白沙（和天下）' },
    { id: 'p7', name: '黄金叶（天叶）' },
    { id: 'p8', name: '中华（金中支）' },
    { id: 'p9', name: '南京（软九五）' },
    { id: 'p10', name: '南京（细支九五）' },
    { id: 'p11', name: '黄金叶（天香细支）' },
    { id: 'p12', name: '南京（雨花石）' },
    { id: 'p13', name: '中华（细支）' },
    { id: 'p14', name: '黄金叶（大成细支）' },
    { id: 'p15', name: '黄金叶（商鼎）' },
    { id: 'p16', name: '中华（金细支）' },
    { id: 'p17', name: '中华（软）' },
    { id: 'p18', name: '中华（细支6mg）' },
    { id: 'p19', name: '中华（双中支）' },
    { id: 'p20', name: '中华（硬）' },
    { id: 'p21', name: '南京（细支九五3mg）' },
    { id: 'p22', name: '南京（大观园爆冰）' },
    { id: 'p23', name: '南京（十二钗烤烟）' },
    { id: 'p24', name: '芙蓉王（硬）' },
    { id: 'p25', name: '钻石（细支荷花）' },
    { id: 'p26', name: '钻石（软荷花）' },
    { id: 'p27', name: '钻石（荷花）' }
];

// 地市排序（按固定顺序）
const cities = ['南京', '无锡', '徐州', '常州', '苏州', '南通', '连云港', '淮安', '盐城', '扬州', '镇江', '泰州', '宿迁'];

// ========== API路由 ==========

// 检查是否已提交
app.get('/api/check-submitted', (req, res) => {
    try {
        const { merchant_id, assigned_date } = req.query;
        const prices = JSON.parse(fs.readFileSync(PRICES_FILE, 'utf8'));
        
        const submitted = prices.some(p => 
            p.merchant_id == merchant_id && 
            p.assigned_date === assigned_date
        );
        
        res.json({ submitted });
    } catch (error) {
        console.error('检查失败:', error);
        res.json({ submitted: false });
    }
});

// 提交价格数据
app.post('/api/submit', (req, res) => {
    try {
        const data = req.body;
        
        // 读取现有数据
        let prices = JSON.parse(fs.readFileSync(PRICES_FILE, 'utf8'));
        
        // 检查是否重复提交（同一商户同一归属日期）
        const existing = prices.find(p => 
            p.merchant_id === data.merchant_id && 
            p.assigned_date === data.assigned_date
        );
        
        if (existing) {
            // 更新已有记录
            Object.assign(existing, data);
        } else {
            // 添加新记录
            prices.push(data);
        }
        
        // 保存数据
        fs.writeFileSync(PRICES_FILE, JSON.stringify(prices, null, 2));
        
        console.log(`✅ 收到数据: ${data.shop_name} - ${data.assigned_date}`);
        
        res.json({ success: true, message: '提交成功' });
    } catch (error) {
        console.error('❌ 保存数据失败:', error);
        res.status(500).json({ success: false, message: '保存失败' });
    }
});

// 获取数据
app.get('/api/data', (req, res) => {
    try {
        const prices = JSON.parse(fs.readFileSync(PRICES_FILE, 'utf8'));
        res.json(prices);
    } catch (error) {
        console.error('读取数据失败:', error);
        res.status(500).json({ error: '读取失败' });
    }
});

// 导出Excel
app.get('/api/export', (req, res) => {
    try {
        const prices = JSON.parse(fs.readFileSync(PRICES_FILE, 'utf8'));
        
        // 创建工作簿
        const wb = XLSX.utils.book_new();
        
        // 按归属日期分组
        const grouped = {};
        prices.forEach(p => {
            if (!grouped[p.assigned_date]) {
                grouped[p.assigned_date] = [];
            }
            grouped[p.assigned_date].push(p);
        });
        
        // 按日期排序
        const dates = Object.keys(grouped).sort();
        
        // 为每个日期创建工作表
        dates.forEach(date => {
            const dayPrices = grouped[date];
            const weekday = dayPrices[0].assigned_weekday;
            
            // 工作表名称（Excel限制31字符）
            const sheetName = `【${weekday}】${date}`.substring(0, 31);
            
            // 构建数据
            const data = [];
            
            // 表头
            const header = ['填写时间', '店名（门头名称）', '店铺所在地市'];
            products.forEach(p => {
                header.push(p.name);
            });
            data.push(header);
            
            // 按地市排序
            dayPrices.sort((a, b) => {
                return cities.indexOf(a.city) - cities.indexOf(b.city);
            });
            
            // 数据行
            dayPrices.forEach(p => {
                const submitTime = new Date(p.submitted_at).toLocaleString('zh-CN', {
                    timeZone: 'Asia/Shanghai'
                });
                const row = [submitTime, p.shop_name, p.city];
                
                products.forEach(prod => {
                    const price = p.prices[prod.id];
                    row.push(price !== undefined && price !== null ? price : '');
                });
                data.push(row);
            });
            
            // 创建工作表
            const ws = XLSX.utils.aoa_to_sheet(data);
            
            // 设置列宽
            ws['!cols'] = [
                { wch: 20 }, // 填写时间
                { wch: 25 }, // 店名
                { wch: 12 }, // 地市
                ...products.map(() => ({ wch: 12 })) // 产品价格
            ];
            
            // 添加工作表到工作簿
            XLSX.utils.book_append_sheet(wb, ws, sheetName);
        });
        
        // 如果没有数据，创建空工作表
        if (dates.length === 0) {
            const ws = XLSX.utils.aoa_to_sheet([['暂无数据']]);
            XLSX.utils.book_append_sheet(wb, ws, '暂无数据');
        }
        
        // 生成Excel文件（Buffer格式）
        const buf = XLSX.write(wb, { 
            type: 'buffer', 
            bookType: 'xlsx',
            compression: true
        });
        
        // 返回文件
        const today = new Date();
        const month = today.getFullYear() + String(today.getMonth() + 1).padStart(2, '0');
        const filename = encodeURIComponent(`${month} 江苏每日产品价格采集.xlsx`);
        
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"; filename*=UTF-8''${filename}`);
        res.send(buf);
    } catch (error) {
        console.error('导出失败:', error);
        res.status(500).json({ error: '导出失败' });
    }
});
// ⚠️ 临时接口：清空所有数据（用完立即删除！）
app.delete('/api/clear-all', (req, res) => {
    try {
        fs.writeFileSync(PRICES_FILE, '[]');
        console.log('✅ 所有数据已清空');
        res.json({ success: true, message: '所有数据已清空' });
    } catch (error) {
        console.error('清空失败:', error);
        res.status(500).json({ success: false, message: '清空失败' });
    }
});
// 启动服务器
app.listen(PORT, () => {
    console.log(`\n========================================`);
    console.log(`🚀 江苏每日价格采集系统已启动`);
    console.log(`========================================`);
    console.log(`📄 商户端: http://localhost:${PORT}`);
    console.log(`👤 管理后台: http://localhost:${PORT}/admin.html`);
    console.log(`📊 数据API: http://localhost:${PORT}/api/data`);
    console.log(`========================================\n`);
});

module.exports = app;
