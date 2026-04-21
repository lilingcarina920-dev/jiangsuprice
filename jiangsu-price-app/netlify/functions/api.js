const XLSX = require('xlsx');

// 产品列表
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

// 地市排序
const cities = ['南京', '无锡', '徐州', '常州', '苏州', '南通', '连云港', '淮安', '盐城', '扬州', '镇江', '泰州', '宿迁'];

// 模拟数据存储（实际项目中应该使用数据库）
let pricesData = [];

exports.handler = async (event, context) => {
    const path = event.path.replace('/.netlify/functions/api', '').replace('/api', '');
    const method = event.httpMethod;
    
    // 设置CORS
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
    };
    
    // 处理OPTIONS请求
    if (method === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }
    
    try {
        // 提交数据
        if (method === 'POST' && path === '/submit') {
            const data = JSON.parse(event.body);
            
            // 检查是否重复
            const existingIndex = pricesData.findIndex(p => 
                p.merchant_id === data.merchant_id && 
                p.assigned_date === data.assigned_date
            );
            
            if (existingIndex >= 0) {
                pricesData[existingIndex] = data;
            } else {
                pricesData.push(data);
            }
            
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ success: true, message: '提交成功' })
            };
        }
        
        // 获取数据
        if (method === 'GET' && path === '/data') {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify(pricesData)
            };
        }
        
        // 导出Excel
        if (method === 'GET' && path === '/export') {
            // 按归属日期分组
            const grouped = {};
            pricesData.forEach(p => {
                if (!grouped[p.assigned_date]) {
                    grouped[p.assigned_date] = [];
                }
                grouped[p.assigned_date].push(p);
            });
            
            const wb = XLSX.utils.book_new();
            const dates = Object.keys(grouped).sort();
            
            dates.forEach(date => {
                const dayPrices = grouped[date];
                const weekday = dayPrices[0].assigned_weekday;
                const sheetName = `【${weekday}】${date}`;
                
                const data = [];
                const header = ['填写时间', '店名（门头名称）', '店铺所在地市'];
                products.forEach(p => header.push(p.name));
                data.push(header);
                
                dayPrices.sort((a, b) => cities.indexOf(a.city) - cities.indexOf(b.city));
                
                dayPrices.forEach(p => {
                    const submitTime = new Date(p.submitted_at).toLocaleString('zh-CN');
                    const row = [submitTime, p.shop_name, p.city];
                    products.forEach(prod => row.push(p.prices[prod.id] || ''));
                    data.push(row);
                });
                
                const ws = XLSX.utils.aoa_to_sheet(data);
                XLSX.utils.book_append_sheet(wb, ws, sheetName);
            });
            
            const buf = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
            
            return {
                statusCode: 200,
                headers: {
                    ...headers,
                    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                },
                body: buf,
                isBase64Encoded: true
            };
        }
        
        return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: 'Not found' })
        };
        
    } catch (error) {
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
};
