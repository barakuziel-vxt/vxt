import axios from 'axios';

// Use relative paths that will go through Vite proxy instead of direct URLs
// This avoids CORS errors by routing through http://localhost:3002/api -> http://localhost:8000
const API_BASE_URL = '/api';

export const eventAPI = {
  // Event endpoints
  getAll: async (entityTypeId = null) => {
    try {
      const params = entityTypeId ? { entityTypeId } : {};
      const response = await axios.get(`${API_BASE_URL}/events`, { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching events:', error);
      throw error;
    }
  },

  getById: async (id) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/events/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching event:', error);
      throw error;
    }
  },

  create: async (data) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/events`, data);
      return response.data;
    } catch (error) {
      console.error('Error creating event:', error);
      throw error;
    }
  },

  update: async (id, data) => {
    try {
      const response = await axios.put(`${API_BASE_URL}/events/${id}`, data);
      return response.data;
    } catch (error) {
      console.error('Error updating event:', error);
      throw error;
    }
  },

  delete: async (id) => {
    try {
      const response = await axios.delete(`${API_BASE_URL}/events/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error deleting event:', error);
      throw error;
    }
  }
};

export const eventAttributeAPI = {
  // EventAttribute endpoints
  getAll: async (eventId = null) => {
    try {
      const params = eventId ? { eventId } : {};
      const response = await axios.get(`${API_BASE_URL}/eventattributes`, { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching event attributes:', error);
      throw error;
    }
  },

  create: async (eventId, attributeId) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/eventattributes`, {
        eventId,
        entityTypeAttributeId: attributeId
      });
      return response.data;
    } catch (error) {
      console.error('Error creating event attribute:', error);
      throw error;
    }
  },

  delete: async (eventId, attributeId) => {
    try {
      const response = await axios.delete(`${API_BASE_URL}/eventattributes`, {
        params: { eventId, attributeId }
      });
      return response.data;
    } catch (error) {
      console.error('Error deleting event attribute:', error);
      throw error;
    }
  }
};

export const analyzeFunctionAPI = {
  // AnalyzeFunction endpoints
  getAll: async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/analyzefunctions`);
      return response.data;
    } catch (error) {
      console.error('Error fetching analyze functions:', error);
      throw error;
    }
  }
};

export const entityTypeAttributeScoreAPI = {
  // EntityTypeAttributeScore endpoints
  getByAttributeId: async (attributeId) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/entitytypeattributescore`, {
        params: { attributeId }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching attribute scores:', error);
      throw error;
    }
  }
};

export const entityAPI = {
  // Entity endpoints
  getAll: async (entityTypeId = null) => {
    try {
      const params = entityTypeId ? { entityTypeId } : {};
      const response = await axios.get(`${API_BASE_URL}/entities`, { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching entities:', error);
      throw error;
    }
  },

  getById: async (id) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/entities/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching entity:', error);
      throw error;
    }
  },

  create: async (data) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/entities`, data);
      return response.data;
    } catch (error) {
      console.error('Error creating entity:', error);
      throw error;
    }
  },

  update: async (id, data) => {
    try {
      const response = await axios.put(`${API_BASE_URL}/entities/${id}`, data);
      return response.data;
    } catch (error) {
      console.error('Error updating entity:', error);
      throw error;
    }
  },

  delete: async (id) => {
    try {
      const response = await axios.delete(`${API_BASE_URL}/entities/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error deleting entity:', error);
      throw error;
    }
  }
};
