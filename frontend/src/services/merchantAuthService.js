import axios from 'axios';

const AUTH_BASE_URL = 'http://localhost:8081/auth/merchant';

class MerchantAuthService {
  async register(email, password, merchantName, domain, businessEmail, businessAddress, checkoutUrlPattern) {
    const response = await axios.post(`${AUTH_BASE_URL}/register`, {
      email,
      password,
      merchant_name: merchantName,
      domain,
      business_email: businessEmail,
      business_address: businessAddress,
      checkout_url_pattern: checkoutUrlPattern,
    });
    
    if (response.data.token) {
      localStorage.setItem('merchantToken', response.data.token);
      localStorage.setItem('merchantInfo', JSON.stringify(response.data.merchant));
    }
    
    return response.data;
  }

  async login(email, password) {
    const response = await axios.post(`${AUTH_BASE_URL}/login`, {
      email,
      password,
    });
    
    if (response.data.token) {
      localStorage.setItem('merchantToken', response.data.token);
      localStorage.setItem('merchantInfo', JSON.stringify(response.data.merchant));
    }
    
    return response.data;
  }

  logout() {
    localStorage.removeItem('merchantToken');
    localStorage.removeItem('merchantInfo');
  }

  getToken() {
    return localStorage.getItem('merchantToken');
  }

  getMerchantInfo() {
    const info = localStorage.getItem('merchantInfo');
    return info ? JSON.parse(info) : null;
  }

  isAuthenticated() {
    return !!this.getToken();
  }
}

export const merchantAuthService = new MerchantAuthService();
