const axios = require('axios');

const V1_BASE = 'https://api.nimbuspost.com/v1';
const V2_BASE = 'https://api-v2.nimbuspost.com/v2';

// Use v2 when API key starts with npk_ and secret is present
const isV2 = () =>
  (process.env.NIMBUSPOST_API_KEY || '').startsWith('npk_') &&
  !!process.env.NIMBUSPOST_API_SECRET;

// ── V1 auth (email + password → JWT token) ──────────────────────────────────
let _token = null;
let _tokenExpiry = 0;

const getV1Token = async () => {
  if (_token && Date.now() < _tokenExpiry) return _token;

  console.log('[NimbusPost] Logging in...');
  const { data: res } = await axios.post(
    `${V1_BASE}/users/login`,
    { email: process.env.NIMBUSPOST_EMAIL, password: process.env.NIMBUSPOST_PASSWORD },
    { headers: { 'Content-Type': 'application/json' }, timeout: 10000 }
  );

  if (!res?.status || !res?.data) {
    throw new Error(`NimbusPost auth failed: ${JSON.stringify(res)}`);
  }

  _token = res.data;
  _tokenExpiry = Date.now() + 3 * 60 * 60 * 1000;
  console.log('[NimbusPost] Login successful');
  return _token;
};

const v1Headers = async () => ({
  Authorization: `Bearer ${await getV1Token()}`,
  'Content-Type': 'application/json',
});

// ── V2 auth (x-api-key + x-api-secret headers) ──────────────────────────────
const v2Headers = () => ({
  'x-api-key': process.env.NIMBUSPOST_API_KEY,
  'x-api-secret': process.env.NIMBUSPOST_API_SECRET,
  'Content-Type': 'application/json',
  'Accept': 'application/json',
});

// ── Create Shipment ──────────────────────────────────────────────────────────
const createShipment = async (order) => {
  return isV2() ? createShipmentV2(order) : createShipmentV1(order);
};

const createShipmentV1 = async (order) => {
  const addr = order.deliveryAddress || {};
  const items = order.items || [];

  const orderItems = items.length
    ? items.map((i) => ({
        name: i.name || i.productName || 'Product',
        qty: String(Number(i.quantity) || 1),
        price: String(Number(i.unitPrice) || 0),
        sku: i.sku || i.productCode || '',
      }))
    : [{ name: 'Products', qty: '1', price: String(Number(order.netAmount) || 0), sku: 'MISC' }];

  const shipperName    = process.env.NIMBUSPOST_SHIPPER_NAME    || 'BrightHorizon';
  const shipperAddress = process.env.NIMBUSPOST_SHIPPER_ADDRESS || '12 Industrial Area Phase 2';
  const shipperCity    = process.env.NIMBUSPOST_SHIPPER_CITY    || 'Hyderabad';
  const shipperState   = process.env.NIMBUSPOST_SHIPPER_STATE   || 'Telangana';
  const shipperPincode = process.env.NIMBUSPOST_SHIPPER_PINCODE || '500072';
  const shipperPhone   = process.env.NIMBUSPOST_SHIPPER_PHONE   || '9876543210';

  const payload = {
    order_number:     order.orderNumber,
    payment_type:     'prepaid',
    order_amount:     Number(order.netAmount) || 1,
    shipping_charges: 0,
    discount:         0,
    cod_charges:      0,
    package_weight:   Math.max(1, Math.round((Number(process.env.NIMBUSPOST_DEFAULT_WEIGHT) || 0.5) * 1000)),
    package_length:   10,
    package_breadth:  10,
    package_height:   10,
    consignee: {
      name:      addr.label || addr.name || addr.city || 'Dealer',
      address:   addr.fullAddress || addr.addressLine1 || addr.address || addr.city || shipperAddress,
      address_2: '',
      city:      addr.city || shipperCity,
      state:     addr.state || process.env.NIMBUSPOST_DEFAULT_STATE || shipperState,
      pincode:   String(addr.postalCode || addr.pincode || addr.zipCode || shipperPincode),
      phone:     String(order.dealerPhone || addr.phone || shipperPhone),
    },
    pickup: {
      warehouse_name: shipperName,
      name:           shipperName,
      address:        shipperAddress,
      address_2:      '',
      city:           shipperCity,
      state:          shipperState,
      pincode:        String(shipperPincode),
      phone:          String(shipperPhone),
    },
    order_items: orderItems,
  };

  console.log('[NimbusPost V1] Creating shipment for', order.orderNumber);
  const { data: res } = await axios.post(`${V1_BASE}/shipments`, payload, {
    headers: await v1Headers(),
    timeout: 15000,
  });

  console.log('[NimbusPost V1] Shipment response:', JSON.stringify(res));

  if (!res?.status) {
    throw new Error(`NimbusPost create shipment failed: ${JSON.stringify(res)}`);
  }

  return res.data;
};

const createShipmentV2 = async (order) => {
  const warehouseId = process.env.NIMBUSPOST_WAREHOUSE_ID;
  if (!warehouseId) {
    throw new Error('NIMBUSPOST_WAREHOUSE_ID is not set. Add your warehouse ID from NimbusPost dashboard to .env');
  }

  const addr = order.deliveryAddress || {};
  const items = order.items || [];

  const orderItems = items.length
    ? items.map((i) => ({
        name:  i.name || i.productName || 'Product',
        qty:   Number(i.quantity) || 1,
        price: Number(i.unitPrice) || 0,
        sku:   i.sku || i.productCode || 'MISC',
      }))
    : [{ name: 'Products', qty: 1, price: Number(order.netAmount) || 0, sku: 'MISC' }];

  const weight = Math.max(1, Math.round((Number(process.env.NIMBUSPOST_DEFAULT_WEIGHT) || 0.5) * 1000));

  const payload = {
    order_number: order.orderNumber,
    order_type:   'b2c',
    payment_mode: 'prepaid',
    warehouse_id: warehouseId,
    shipping_address: {
      name:    addr.label || addr.name || addr.city || 'Dealer',
      address: addr.fullAddress || addr.addressLine1 || addr.address || addr.city || '12 Industrial Area Phase 2',
      pincode: Number(addr.postalCode || addr.pincode || addr.zipCode || process.env.NIMBUSPOST_SHIPPER_PINCODE || 500072),
      city:    addr.city  || process.env.NIMBUSPOST_SHIPPER_CITY  || 'Hyderabad',
      state:   addr.state || process.env.NIMBUSPOST_DEFAULT_STATE || 'Telangana',
      phone:   Number(order.dealerPhone || addr.phone || process.env.NIMBUSPOST_SHIPPER_PHONE || 9876543210),
    },
    items: orderItems,
    package: {
      weight,
      length: 10,
      width:  10,
      height: 10,
    },
  };

  console.log('[NimbusPost V2] Creating shipment for', order.orderNumber);
  const { data: res } = await axios.post(`${V2_BASE}/shipments`, payload, {
    headers: v2Headers(),
    timeout: 15000,
  });

  console.log('[NimbusPost V2] Shipment response:', JSON.stringify(res));

  if (!res?.success) {
    throw new Error(`NimbusPost create shipment failed: ${JSON.stringify(res?.error || res)}`);
  }

  // v2 response: { success: true, data: { order: {...}, booking: { awb, courier_name, ... } } }
  const booking = res.data?.booking;
  return {
    awb_number:   booking?.awb,
    courier_name: booking?.courier_name,
    shipment_id:  booking?.order_id,
  };
};

// ── Track Shipment ───────────────────────────────────────────────────────────
const trackShipment = async (awb) => {
  if (isV2()) {
    const { data: res } = await axios.get(`${V2_BASE}/tracking/${awb}`, {
      headers: v2Headers(),
      timeout: 10000,
    });
    return res?.data || {};
  }
  const { data: res } = await axios.get(`${V1_BASE}/shipments/track/${awb}`, {
    headers: await v1Headers(),
    timeout: 10000,
  });
  return res?.data || [];
};

// ── Cancel Shipment ──────────────────────────────────────────────────────────
const cancelShipment = async (awb) => {
  if (isV2()) {
    const { data: res } = await axios.post(
      `${V2_BASE}/shipments/cancel`,
      { awb },
      { headers: v2Headers(), timeout: 10000 }
    );
    return res;
  }
  const { data: res } = await axios.post(
    `${V1_BASE}/shipments/cancel`,
    { awbs: [awb] },
    { headers: await v1Headers(), timeout: 10000 }
  );
  return res;
};

module.exports = { createShipment, trackShipment, cancelShipment };
