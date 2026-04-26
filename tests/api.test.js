process.env.NODE_ENV = 'test';

const fs = require('fs');
const path = require('path');

// DB 초기화 전에 이전 테스트 DB 삭제 시도 (app을 require하기 전에 실행해야 EBUSY 에러 방지)
const dbPath = path.join(__dirname, '../database/test.db');
const shmPath = dbPath + '-shm';
const walPath = dbPath + '-wal';
try {
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);
  if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
} catch(e) {}

const request = require('supertest');
const app = require('../server');
const { getDb } = require('../database/db');

let token = '';
let db;

beforeAll((done) => {
  db = getDb();
  // 테스트용 admin 계정은 db.js의 seedDefaultData에서 자동 생성됨 (admin/admin1234)
  done();
});

afterAll((done) => {
  // 서버가 싱글톤 DB를 계속 잡고 있어서 여기서 삭제하면 EBUSY 발생함
  // 대신 beforeAll에서 다음 테스트 실행 전 삭제하도록 변경
  done();
});

describe('Antigravity ERP API Integration Tests', () => {

  describe('1. Auth API', () => {
    it('should login successfully with admin credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'admin', password: 'admin1234' });

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('token');
      expect(res.body.user).toHaveProperty('username', 'admin');

      token = res.body.token; // 이후 테스트에서 사용
    });

    it('should fail login with wrong password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'admin', password: 'wrongpassword' });

      expect(res.statusCode).toEqual(401);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('2. Materials API', () => {
    it('should fetch materials list', async () => {
      const res = await request(app)
        .get('/api/materials')
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toEqual(200);
      expect(Array.isArray(res.body)).toBeTruthy();
    });

    it('should create a new material', async () => {
      const res = await request(app)
        .post('/api/materials')
        .set('Authorization', `Bearer ${token}`)
        .send({
          code: 'TE-ST-999',
          name: 'Test Material',
          category: '부자재',
          unit: 'EA',
          safety_stock: 10
        });

      if (res.statusCode !== 200) console.error(res.body);
      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('code', 'TE-ST-999');
    });

    it('should update the material', async () => {
      const res = await request(app)
        .put('/api/materials/TE-ST-999')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Updated Test Material',
          category: '부자재',
          unit: 'EA'
        });

      if (res.statusCode !== 200) console.error(res.body);
      expect(res.statusCode).toEqual(200);
      // PUT API only returns { success: true }, not the object itself
      expect(res.body).toHaveProperty('success', true);
    });
  });

  describe('3. Inventory API', () => {
    it('should fetch inventory list', async () => {
      const res = await request(app)
        .get('/api/inventory')
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toEqual(200);
      expect(Array.isArray(res.body)).toBeTruthy();
    });

    it('should get dashboard summary', async () => {
      const res = await request(app)
        .get('/api/inventory/summary/dashboard')
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('total_materials');
      expect(res.body).toHaveProperty('total_stock_value');
    });
  });

  describe('4. Sales Orders API', () => {
    let customerCode = '';

    beforeAll(async () => {
      // Create a test customer first to use for sales order
      const custRes = await request(app)
        .post('/api/customers')
        .set('Authorization', `Bearer ${token}`)
        .send({
          code: 'TEST-CUST-001',
          name: 'Test Customer',
          business_no: '999-99-99999'
        });
      if(custRes.statusCode === 201) {
        customerCode = custRes.body.code;
      } else {
        // If it fails (maybe already exists), fallback to default
        customerCode = 'C001';
      }
    });

    it('should create a new sales order', async () => {
      const res = await request(app)
        .post('/api/sales-orders')
        .set('Authorization', `Bearer ${token}`)
        .send({
          customer_code: customerCode,
          order_date: '2026-04-08',
          items: [
            { material_code: 'RM-ST-001', qty: 10, unit_price: 15000 }
          ],
          notes: 'Test Order'
        });

      if (res.statusCode !== 200) console.error(res.body);
      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('so_no');
      // POST API doesn't return items, just { success, id, so_no }
    });

    it('should fetch sales orders list', async () => {
      const res = await request(app)
        .get('/api/sales-orders')
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toEqual(200);
      expect(Array.isArray(res.body)).toBeTruthy();
      expect(res.body.length).toBeGreaterThan(0);
    });
  });
});
