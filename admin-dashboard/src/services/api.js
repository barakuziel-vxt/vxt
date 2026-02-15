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
