require('dotenv').config(); // eslint-disable-line import/no-extraneous-dependencies
const moment = require('moment-timezone');

const Lalamove = require('../Lalamove');

const {
  API_KEY,
  API_SECRET,
  MARKET,
} = process.env;

const lalamove = new Lalamove({
  apiSecret: API_SECRET,
  apiKey: API_KEY,
  market: MARKET,
  env: 'sandbox',
});

jest.setTimeout(30000);

describe('Lalamove Test', () => {
  test('get city info', async () => {
    const { data: cityInfo } = await lalamove.getCityInfo();
    console.log(cityInfo);
    expect(cityInfo.length).toEqual(4);
    expect(cityInfo[0].locode).toEqual('TW KHH');
    expect(cityInfo[1].locode).toEqual('TW TNN');
    expect(cityInfo[2].locode).toEqual('TW TPE');
    expect(cityInfo[3].locode).toEqual('TW TXG');
  });

  test('create a expired quote', async () => {
    const quotationInput = {
      data: {
        scheduleAt: '2023-09-18T07:46:53.321Z',
        serviceType: 'MOTORCYCLE',
        language: 'zh_TW',
        stops: [
          {
            coordinates: {
              lat: '24.995049',
              lng: '121.433826',
            },
            address: '新北市板橋區金門街1號',
          },
          {
            coordinates: {
              lat: '24.982437',
              lng: '121.427702',
            },
            address: '新北市板橋區溪城路121號',
          },
        ],
        isRouteOptimized: false, // optional only for quotations
        item: {
          quantity: '1',
          weight: 'LESS_THAN_3_KG',
          categories: [
            'FOOD_AND_BEVERAGE',
          ],
          handlingInstructions: [
            'KEEP_UPRIGHT',
          ],
        },
      },
    };
    let quotation;
    try {
      const { data } = await lalamove.createQuotation(quotationInput);
      quotation = data;
    } catch (e) {
      console.log(e);
      expect(quotation).toEqual(undefined);
      expect(e).toEqual(
        expect.arrayContaining([expect.objectContaining({
          id: 'ERR_INVALID_FIELD',
          detail: '/data/scheduleAt',
          message: "'2023-09-18T07:46:53.321Z' is not valid 'scheduleAt'. Date cannot be a past date or more than 30 days in advance.",
        })]),
      );
    }
  });

  test('create a out out range quote', async () => {
    const deliveryBy = moment().tz('Asia/Taipei').add(1, 'days').startOf('day')
      .add(12, 'hours')
      .toISOString();
    const quotationInput = {
      data: {
        scheduleAt: deliveryBy,
        serviceType: 'MOTORCYCLE',
        language: 'zh_TW',
        stops: [
          {
            coordinates: {
              lat: '24.674703',
              lng: '120.860649',
            },
            address: '苗栗縣竹南鎮海口里10鄰國校前48號',
          },
          {
            coordinates: {
              lat: '24.599651',
              lng: '120.835623',
            },
            address: '苗栗縣頭屋鄉獅潭村10鄰140號',
          },
        ],
        isRouteOptimized: false, // optional only for quotations
        item: {
          quantity: '1',
          weight: 'LESS_THAN_3_KG',
          categories: [
            'FOOD_AND_BEVERAGE',
          ],
          handlingInstructions: [
            'KEEP_UPRIGHT',
          ],
        },
      },
    };
    let quotation;
    try {
      const { data } = await lalamove.createQuotation(quotationInput);
      quotation = data;
    } catch (e) {
      console.log(e);
      expect(quotation).toEqual(undefined);
      expect(e).toEqual(
        expect.arrayContaining([expect.objectContaining({
          id: 'ERR_OUT_OF_SERVICE_AREA',
          message: 'Given latitude/longitude is out of service area.',
        })]),
      );
    }
  });

  test('create quote, place order and cancel order', async () => {
    const deliveryBy = moment().tz('Asia/Taipei').add(1, 'days').startOf('day')
      .add(12, 'hours')
      .toISOString();
    const quotationInput = {
      data: {
        scheduleAt: deliveryBy,
        serviceType: 'MOTORCYCLE',
        language: 'zh_TW',
        stops: [
          {
            coordinates: {
              lat: '24.995049',
              lng: '121.433826',
            },
            address: '新北市板橋區金門街1號',
          },
          {
            coordinates: {
              lat: '24.982437',
              lng: '121.427702',
            },
            address: '新北市板橋區溪城路121號',
          },
        ],
        isRouteOptimized: false, // optional only for quotations
        item: {
          quantity: '1',
          weight: 'LESS_THAN_3_KG',
          categories: [
            'FOOD_AND_BEVERAGE',
          ],
          handlingInstructions: [
            'KEEP_UPRIGHT',
          ],
        },
      },
    };

    const { data: quotation } = await lalamove.createQuotation(quotationInput);
    console.log(quotation);
    expect(quotation.priceBreakdown.total).toEqual('68');
    expect(quotation.priceBreakdown.currency).toEqual('TWD');
    expect(quotation.distance.value).toEqual('1922');
    expect(quotation.distance.unit).toEqual('m');

    const { quotationId, stops } = quotation;

    const orderInput = {
      data: {
        quotationId,
        sender: {
          stopId: stops[0].stopId,
          name: 'Michal',
          phone: '+886922800029',
        },

        recipients: [{
          stopId: stops[1].stopId,
          name: 'Katrina',
          phone: '+886922800029',
          remarks: 'YYYYYY', // optional
        },

        ],
        isPODEnabled: true, // optional
        partner: 'Lalamove Partner 1', // optional
      },
    };
    const { data: order } = await lalamove.placeOrder(orderInput);
    console.log(order);
    expect(order.priceBreakdown.total).toEqual('68');
    expect(order.priceBreakdown.currency).toEqual('TWD');
    expect(order.quotationId).toEqual(quotationId);
    expect(order.status).toEqual('ASSIGNING_DRIVER');

    const { data: orderDetails } = await lalamove.getOrderDetails(order.orderId);
    console.log(orderDetails);
    expect(orderDetails.priceBreakdown.total).toEqual('68');
    expect(orderDetails.priceBreakdown.currency).toEqual('TWD');
    expect(orderDetails.quotationId).toEqual(quotationId);
    expect(orderDetails.status).toEqual('ASSIGNING_DRIVER');
    expect(orderDetails.stops[1].POD.status).toEqual('PENDING');

    const response = await lalamove.cancelOrder(order.orderId);
    expect(response).toEqual('');
  });
});
