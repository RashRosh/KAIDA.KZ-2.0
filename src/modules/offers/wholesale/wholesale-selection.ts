import { offers } from '../db/offers.table';

// wholesale-price: the Offer's wholesale columns for a select; read them back with wholesaleFromColumns.
export const offerWholesaleSelection = {
  wholesalePriceAmount: offers.wholesalePriceAmount,
  wholesaleBatchCount: offers.wholesaleBatchCount,
  wholesaleContainer: offers.wholesaleContainer,
  wholesaleContainerText: offers.wholesaleContainerText,
  wholesalePerContainer: offers.wholesalePerContainer,
};
