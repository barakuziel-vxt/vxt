import axios from 'axios';

const API_BASE_URL = '/api';

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
  getAll: async () => {
    const response = await api.get('/customersubscriptions');
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
  getAll: async () => {
    const response = await api.get('/customerentities');
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

export default api;
