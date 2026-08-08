/**
 * tracker.js
 * Adaptador leve redirecionando para o trackingService centralizado.
 * Código legado de heatmaps, cursores e gravações de sessão FOI TOTALMENTE REMOVIDO.
 */

import { trackingService, getTrafficOrigin, getDeviceAndBrowser } from '../services/trackingService';

export const tracker = {
  init(initialPage = 'Loja') {
    trackingService.init(initialPage);
  },

  updateLeadInfo(nome, email) {
    trackingService.updateCustomerData(nome, email);
  },

  setVehicle(vehicleName) {
    trackingService.setVehicle(vehicleName);
  },

  updateStage(stageName) {
    trackingService.updateStage(stageName);
  }
};

export { getTrafficOrigin, getDeviceAndBrowser };
