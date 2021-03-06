import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,

    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,

    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const checkCustomerExists = await this.customersRepository.findById(
      customer_id,
    );

    if (!checkCustomerExists) {
      throw new AppError("You can't place an order with a inexistent user.");
    }

    const customer = checkCustomerExists;

    const allProductsIds = products.map(product => {
      const { id } = product;
      return { id };
    });

    const checkProductsExists = await this.productsRepository.findAllById(
      allProductsIds,
    );

    if (checkProductsExists.length < allProductsIds.length) {
      throw new AppError('One or more products are invalid or inexistent.');
    }

    const orderProducts = checkProductsExists.map(product => {
      const productToCheckQuantity = products.filter(
        productFiltered => productFiltered.id === product.id,
      );
      if (product.quantity < productToCheckQuantity[0].quantity) {
        throw new AppError(
          'One or more products quantity are lower them available in stock.',
        );
      }

      const { id, price } = product;
      const { quantity } = productToCheckQuantity[0];

      const productToInsert = {
        product_id: id,
        price,
        quantity,
      };

      return productToInsert;
    });

    const updateProducts = orderProducts.map(product => {
      const { product_id, quantity } = product;

      return { id: product_id, quantity };
    });

    await this.productsRepository.updateQuantity(updateProducts);

    const order = await this.ordersRepository.create({
      customer,
      products: orderProducts,
    });

    return order;
  }
}

export default CreateOrderService;
