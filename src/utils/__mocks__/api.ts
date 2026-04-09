/**
 * Manual mock for @/utils/api.
 * Placed adjacent to the real module so jest.mock('@/utils/api') picks it up automatically.
 */
const api = {
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  patch: jest.fn(),
  delete: jest.fn(),
  interceptors: {
    request: { use: jest.fn() },
    response: { use: jest.fn() },
  },
};

export default api;
