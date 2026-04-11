import axios from 'axios';

function resolveBaseUrl() {
  try {
    const params = new URLSearchParams(window.location.search);
    const dsType = params.get('dsType');
    const cloudUrl = params.get('cloudUrl');
    const localUrl = params.get('localUrl');
    if (dsType && (cloudUrl || localUrl)) {
      const url = dsType === 'cloud' ? cloudUrl : localUrl;
      return url.endsWith('/') ? url.slice(0, -1) : url;
    }
  } catch { /* ignore */ }
  return import.meta.env.VITE_API_BASE_URL || '/api';
}

const API_BASE_URL = resolveBaseUrl();

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// EntityCategory APIs
export const entityCategoryAPI = {
  getAll: async () => {
    const response = await api.get('/entitycategories');
    return response.data;
  },
  getById: async (id) => {
    const response = await api.get(`/entitycategories/${id}`);
    return response.data;
  },
  create: async (data) => {
    const response = await api.post('/entitycategories', data);
    return response.data;
  },
  update: async (id, data) => {
    const response = await api.put(`/entitycategories/${id}`, data);
    return response.data;
  },
  delete: async (id) => {
    const response = await api.delete(`/entitycategories/${id}`);
    return response.data;
  },
};

// EntityType APIs
export const entityTypeAPI = {
  getAll: async () => {
    const response = await api.get('/entitytypes');
    return response.data;
  },
  getById: async (id) => {
    const response = await api.get(`/entitytypes/${id}`);
    return response.data;
  },
  create: async (data) => {
    const response = await api.post('/entitytypes', data);
    return response.data;
  },
  update: async (id, data) => {
    const response = await api.put(`/entitytypes/${id}`, data);
    return response.data;
  },
  delete: async (id) => {
    const response = await api.delete(`/entitytypes/${id}`);
    return response.data;
  },
};

// EntityTypeAttribute APIs
export const entityTypeAttributeAPI = {
  getAll: async () => {
    const response = await api.get('/entitytypeattributes');
    return response.data;
  },
  getById: async (id) => {
    const response = await api.get(`/entitytypeattributes/${id}`);
    return response.data;
  },
  create: async (data) => {
    const response = await api.post('/entitytypeattributes', data);
    return response.data;
  },
  update: async (id, data) => {
    const response = await api.put(`/entitytypeattributes/${id}`, data);
    return response.data;
  },
  delete: async (id) => {
    const response = await api.delete(`/entitytypeattributes/${id}`);
    return response.data;
  },
};

// Protocol APIs
export const protocolAPI = {
  getAll: async () => {
    const response = await api.get('/protocols');
    return response.data;
  },
  create: async (data) => {
    const response = await api.post('/protocols', data);
    return response.data;
  },
  update: async (id, data) => {
    const response = await api.put(`/protocols/${id}`, data);
    return response.data;
  },
  delete: async (id) => {
    const response = await api.delete(`/protocols/${id}`);
    return response.data;
  },
};

// ProtocolAttribute APIs
export const protocolAttributeAPI = {
  getByProtocolId: async (protocolId) => {
    const response = await api.get(`/protocolattributes?protocolId=${protocolId}`);
    return response.data;
  },
  getAll: async () => {
    const response = await api.get('/protocolattributes');
    return response.data;
  },
  create: async (data) => {
    const response = await api.post('/protocolattributes', data);
    return response.data;
  },
  update: async (id, data) => {
    const response = await api.put(`/protocolattributes/${id}`, data);
    return response.data;
  },
  delete: async (id) => {
    const response = await api.delete(`/protocolattributes/${id}`);
    return response.data;
  },
};

// Provider APIs
export const providerAPI = {
  getAll: async () => {
    const response = await api.get('/providers');
    return response.data;
  },
  getById: async (id) => {
    const response = await api.get(`/providers/${id}`);
    return response.data;
  },
  create: async (data) => {
    const response = await api.post('/providers', data);
    return response.data;
  },
  update: async (id, data) => {
    const response = await api.put(`/providers/${id}`, data);
    return response.data;
  },
  delete: async (id) => {
    const response = await api.delete(`/providers/${id}`);
    return response.data;
  },
};

// Customer APIs
export const customerAPI = {
  getAll: async () => {
    const response = await api.get('/customers');
    return response.data;
  },
  getById: async (id) => {
    const response = await api.get(`/customers/${id}`);
    return response.data;
  },
  create: async (data) => {
    const response = await api.post('/customers', data);
    return response.data;
  },
  update: async (id, data) => {
    const response = await api.put(`/customers/${id}`, data);
    return response.data;
  },
  delete: async (id) => {
    const response = await api.delete(`/customers/${id}`);
    return response.data;
  },
};

// Entity APIs
export const entityAPI = {
  getAll: async () => {
    const response = await api.get('/entities');
    return response.data;
  },
  getById: async (id) => {
    const response = await api.get(`/entities/${id}`);
    return response.data;
  },
  create: async (data) => {
    const response = await api.post('/entities', data);
    return response.data;
  },
  update: async (id, data) => {
    const response = await api.put(`/entities/${id}`, data);
    return response.data;
  },
  delete: async (id) => {
    const response = await api.delete(`/entities/${id}`);
    return response.data;
  },
};

// Event APIs
export const eventAPI = {
  getAll: async () => {
    const response = await api.get('/events');
    return response.data;
  },
  getById: async (id) => {
    const response = await api.get(`/events/${id}`);
    return response.data;
  },
  create: async (data) => {
    const response = await api.post('/events', data);
    return response.data;
  },
  update: async (id, data) => {
    const response = await api.put(`/events/${id}`, data);
    return response.data;
  },
  delete: async (id) => {
    const response = await api.delete(`/events/${id}`);
    return response.data;
  },
};

// CustomerSubscription APIs
export const customerSubscriptionAPI = {
  getAll: async (status) => {
    let url = '/customersubscriptions';
    if (status) {
      url += `?status=${status}`;
    }
    const response = await api.get(url);
    return response.data;
  },
  getById: async (id) => {
    const response = await api.get(`/customersubscriptions/${id}`);
    return response.data;
  },
  create: async (data) => {
    const response = await api.post('/customersubscriptions', data);
    return response.data;
  },
  update: async (id, data) => {
    const response = await api.put(`/customersubscriptions/${id}`, data);
    return response.data;
  },
  delete: async (id) => {
    const response = await api.delete(`/customersubscriptions/${id}`);
    return response.data;
  },
};

// CustomerEntity APIs
export const customerEntityAPI = {
  getAll: async (status) => {
    let url = '/customerentities';
    if (status) {
      url += `?status=${status}`;
    }
    const response = await api.get(url);
    return response.data;
  },
  getById: async (id) => {
    const response = await api.get(`/customerentities/${id}`);
    return response.data;
  },
  create: async (data) => {
    const response = await api.post('/customerentities', data);
    return response.data;
  },
  update: async (id, data) => {
    const response = await api.put(`/customerentities/${id}`, data);
    return response.data;
  },
  delete: async (id) => {
    const response = await api.delete(`/customerentities/${id}`);
    return response.data;
  },
};

// ProviderEvent APIs
export const providerEventAPI = {
  getAll: async () => {
    const response = await api.get('/providerevents');
    return response.data;
  },
  getById: async (id) => {
    const response = await api.get(`/providerevents/${id}`);
    return response.data;
  },
  create: async (data) => {
    const response = await api.post('/providerevents', data);
    return response.data;
  },
  update: async (id, data) => {
    const response = await api.put(`/providerevents/${id}`, data);
    return response.data;
  },
  delete: async (id) => {
    const response = await api.delete(`/providerevents/${id}`);
    return response.data;
  },
};

// EntityTypeAttributeScore APIs
export const entityTypeAttributeScoreAPI = {
  getAll: async () => {
    const response = await api.get('/entitytypeattributescore');
    return response.data;
  },
  getByAttributeId: async (attributeId) => {
    const response = await api.get(`/entitytypeattributescore?attributeId=${attributeId}`);
    return response.data;
  },
  create: async (data) => {
    const response = await api.post('/entitytypeattributescore', data);
    return response.data;
  },
  update: async (id, data) => {
    const response = await api.put(`/entitytypeattributescore/${id}`, data);
    return response.data;
  },
  delete: async (id) => {
    const response = await api.delete(`/entitytypeattributescore/${id}`);
    return response.data;
  },
};

// EntityIoTDevice APIs
export const entityIoTDeviceAPI = {
  getAll: async () => {
    const response = await api.get('/entityiotdevices');
    return response.data;
  },
  getByEntityId: async (entityId) => {
    const response = await api.get(`/entityiotdevices?entityId=${entityId}`);
    return response.data;
  },
  create: async (data) => {
    const response = await api.post('/entityiotdevices', data);
    return response.data;
  },
  update: async (id, data) => {
    const response = await api.put(`/entityiotdevices/${id}`, data);
    return response.data;
  },
  delete: async (id) => {
    const response = await api.delete(`/entityiotdevices/${id}`);
    return response.data;
  },
};

// Twin API – uses /api/v1 prefix (Vite proxy handles dev, full URL for prod)
const twinBase = import.meta.env.VITE_API_BASE_URL?.startsWith('http')
  ? import.meta.env.VITE_API_BASE_URL
  : '';
export const twinAPI = {
  preview: async (entityId) => {
    const response = await axios.get(`${twinBase}/api/v1/twin/${entityId}`);
    return response.data;
  },
  pushToAzure: async (entityId) => {
    const response = await axios.post(`${twinBase}/api/v1/twin/${entityId}/push`);
    return response.data;
  },
  registerDevice: async (entityId, deviceId) => {
    const response = await axios.post(`${twinBase}/api/v1/device/register`, { entityId, deviceId });
    return response.data;
  },
};

// CustomerGeofenceCriteria APIs
export const customerGeofenceCriteriaAPI = {
  getAll: async (customerId = null, status = null) => {
    let url = '/customergeofencecriteria';
    const params = new URLSearchParams();
    if (customerId) params.append('customer_id', customerId);
    if (status) params.append('status', status);
    if (params.toString()) url += '?' + params.toString();
    const response = await api.get(url);
    return response.data;
  },
  getById: async (id) => {
    const response = await api.get(`/customergeofencecriteria/${id}`);
    return response.data;
  },
  create: async (data) => {
    const response = await api.post('/customergeofencecriteria', data);
    return response.data;
  },
  update: async (id, data) => {
    const response = await api.put(`/customergeofencecriteria/${id}`, data);
    return response.data;
  },
  delete: async (id) => {
    const response = await api.delete(`/customergeofencecriteria/${id}`);
    return response.data;
  },
};

// Push Notification Admin APIs
export const pushNotificationAPI = {
  getAll: async () => {
    const response = await api.get('/admin/push-settings');
    return response.data;
  },
  update: async (id, data) => {
    const response = await api.put(`/push-settings/${id}`, data);
    return response.data;
  },
};

// User Authorization Admin APIs
export const userAuthorizationAPI = {
  getAll: async () => {
    const response = await api.get('/admin/authorizations');
    return response.data;
  },
  update: async (id, data) => {
    const response = await api.put(`/authorizations/${id}`, data);
    return response.data;
  },
};

// AppUser APIs
export const appUserAPI = {
  getAll: async () => {
    const response = await api.get('/appusers');
    return response.data;
  },
};

export default api;
