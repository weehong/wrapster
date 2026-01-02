import { databaseService, Query } from './database'
import { auditLogService } from './audit-log'

import type {
  CreateProductComponentInput,
  CreateProductInput,
  Product,
  ProductComponent,
  ProductWithComponents,
  UpdateProductInput,
} from '@/types/product'
import { COLLECTIONS } from '@/types/product'

export const productService = {
  /**
   * Internal: Get a product by ID without audit logging
   * Use for batch operations where we log once at the end
   */
  async _getByIdInternal(productId: string): Promise<Product> {
    return databaseService.getDocument<Product>(COLLECTIONS.PRODUCTS, productId)
  },

  /**
   * Internal: Batch fetch products by IDs without audit logging
   */
  async _getByIdsInternal(productIds: string[]): Promise<Map<string, Product>> {
    if (productIds.length === 0) return new Map()

    const result = await databaseService.listDocuments<Product>(COLLECTIONS.PRODUCTS, [
      Query.equal('$id', productIds),
      Query.limit(productIds.length),
    ])

    const productMap = new Map<string, Product>()
    for (const product of result.documents) {
      productMap.set(product.$id, product)
    }
    return productMap
  },

  /**
   * Internal: Batch fetch products by barcodes without audit logging
   */
  async _getByBarcodesInternal(barcodes: string[]): Promise<Map<string, Product>> {
    if (barcodes.length === 0) return new Map()

    const result = await databaseService.listDocuments<Product>(COLLECTIONS.PRODUCTS, [
      Query.equal('barcode', barcodes),
      Query.limit(barcodes.length),
    ])

    const productMap = new Map<string, Product>()
    for (const product of result.documents) {
      productMap.set(product.barcode, product)
    }
    return productMap
  },

  /**
   * Internal: Update stock without individual audit logging
   * Used for batch operations
   */
  async _updateStockInternal(productId: string, newQuantity: number): Promise<Product> {
    return databaseService.updateDocument<Product>(COLLECTIONS.PRODUCTS, productId, {
      stock_quantity: Math.max(0, newQuantity),
    })
  },

  /**
   * Create a new product
   */
  async create(data: CreateProductInput): Promise<Product> {
    try {
      const product = await databaseService.createDocument<Product>(COLLECTIONS.PRODUCTS, {
        sku_code: data.sku_code ?? null,
        barcode: data.barcode,
        name: data.name,
        type: data.type ?? 'single',
        cost: data.cost ?? 0,
        stock_quantity: data.stock_quantity ?? 0,
      })

      auditLogService.log('product_create', 'product', {
        resource_id: product.$id,
        action_details: {
          barcode: data.barcode,
          name: data.name,
          type: data.type ?? 'single',
          sku_code: data.sku_code,
        },
      }).catch(console.error)

      return product
    } catch (error) {
      auditLogService.log('product_create', 'product', {
        action_details: {
          barcode: data.barcode,
          name: data.name,
          type: data.type ?? 'single',
        },
        status: 'failure',
        error_message: error instanceof Error ? error.message : 'Unknown error',
      }).catch(console.error)
      throw error
    }
  },

  /**
   * Get a product by ID
   */
  async getById(productId: string): Promise<Product> {
    const product = await databaseService.getDocument<Product>(COLLECTIONS.PRODUCTS, productId)

    auditLogService.log('product_view', 'product', {
      resource_id: productId,
      action_details: { barcode: product.barcode, name: product.name },
    }).catch(console.error)

    return product
  },

  /**
   * Get a product by barcode (for scanning)
   */
  async getByBarcode(barcode: string): Promise<Product | null> {
    const result = await databaseService.listDocuments<Product>(
      COLLECTIONS.PRODUCTS,
      [Query.equal('barcode', barcode), Query.limit(1)]
    )
    const product = result.documents[0] ?? null

    auditLogService.log('product_search_barcode', 'product', {
      resource_id: product?.$id,
      action_details: { barcode, found: !!product },
    }).catch(console.error)

    return product
  },

  /**
   * Get a product by SKU code
   */
  async getBySku(skuCode: string): Promise<Product | null> {
    const result = await databaseService.listDocuments<Product>(
      COLLECTIONS.PRODUCTS,
      [Query.equal('sku_code', skuCode), Query.limit(1)]
    )
    const product = result.documents[0] ?? null

    auditLogService.log('product_search_sku', 'product', {
      resource_id: product?.$id,
      action_details: { skuCode, found: !!product },
    }).catch(console.error)

    return product
  },

  /**
   * List all products with optional filters
   */
  async list(options?: {
    type?: 'single' | 'bundle'
    limit?: number
    offset?: number
    search?: string
    barcodes?: string[] // Batch fetch by barcodes
  }): Promise<{ documents: Product[]; total: number }> {
    const queries: string[] = []

    if (options?.type) {
      queries.push(Query.equal('type', options.type))
    }
    if (options?.barcodes && options.barcodes.length > 0) {
      // Batch fetch by barcodes
      queries.push(Query.equal('barcode', options.barcodes))
    }
    if (options?.search) {
      // Search across barcode, name, and sku_code using OR
      queries.push(
        Query.or([
          Query.contains('barcode', options.search),
          Query.contains('name', options.search),
          Query.contains('sku_code', options.search),
        ])
      )
    }
    if (options?.limit) {
      queries.push(Query.limit(options.limit))
    }
    if (options?.offset) {
      queries.push(Query.offset(options.offset))
    }

    const result = await databaseService.listDocuments<Product>(COLLECTIONS.PRODUCTS, queries)

    auditLogService.log('product_list', 'product', {
      action_details: {
        filters: options,
        resultCount: result.documents.length,
        total: result.total,
      },
    }).catch(console.error)

    return result
  },

  /**
   * Update a product
   */
  async update(productId: string, data: UpdateProductInput): Promise<Product> {
    try {
      const product = await databaseService.updateDocument<Product>(
        COLLECTIONS.PRODUCTS,
        productId,
        data
      )

      auditLogService.log('product_update', 'product', {
        resource_id: productId,
        action_details: {
          updates: data,
          barcode: product.barcode,
          name: product.name,
        },
      }).catch(console.error)

      return product
    } catch (error) {
      auditLogService.log('product_update', 'product', {
        resource_id: productId,
        action_details: { updates: data },
        status: 'failure',
        error_message: error instanceof Error ? error.message : 'Unknown error',
      }).catch(console.error)
      throw error
    }
  },

  /**
   * Delete a product and its components
   */
  async delete(productId: string): Promise<void> {
    try {
      // Get product details before deletion for audit
      let productDetails: { barcode?: string; name?: string } = {}
      try {
        const product = await databaseService.getDocument<Product>(COLLECTIONS.PRODUCTS, productId)
        productDetails = { barcode: product.barcode, name: product.name }
      } catch {
        // Product may not exist, continue with deletion
      }

      // First, delete any components where this product is a parent or child
      const parentComponents = await databaseService.listDocuments<ProductComponent>(
        COLLECTIONS.PRODUCT_COMPONENTS,
        [Query.equal('parent_product_id', productId)]
      )
      const childComponents = await databaseService.listDocuments<ProductComponent>(
        COLLECTIONS.PRODUCT_COMPONENTS,
        [Query.equal('child_product_id', productId)]
      )

      // Delete all related components
      for (const component of [
        ...parentComponents.documents,
        ...childComponents.documents,
      ]) {
        await databaseService.deleteDocument(
          COLLECTIONS.PRODUCT_COMPONENTS,
          component.$id
        )
      }

      // Delete the product
      await databaseService.deleteDocument(COLLECTIONS.PRODUCTS, productId)

      auditLogService.log('product_delete', 'product', {
        resource_id: productId,
        action_details: {
          ...productDetails,
          componentsDeleted: parentComponents.documents.length + childComponents.documents.length,
        },
      }).catch(console.error)
    } catch (error) {
      auditLogService.log('product_delete', 'product', {
        resource_id: productId,
        status: 'failure',
        error_message: error instanceof Error ? error.message : 'Unknown error',
      }).catch(console.error)
      throw error
    }
  },

  /**
   * Get a product with its components (for bundles)
   */
  async getWithComponents(productId: string): Promise<ProductWithComponents> {
    const product = await this.getById(productId)

    if (product.type !== 'bundle') {
      return product
    }

    const componentsResult =
      await databaseService.listDocuments<ProductComponent>(
        COLLECTIONS.PRODUCT_COMPONENTS,
        [Query.equal('parent_product_id', productId)]
      )

    const components = await Promise.all(
      componentsResult.documents.map(async (component) => ({
        product: await this.getById(component.child_product_id),
        quantity: component.quantity,
      }))
    )

    return {
      ...product,
      components,
    }
  },

  /**
   * Update stock quantity for a product
   */
  async updateStock(productId: string, newQuantity: number): Promise<Product> {
    try {
      const product = await databaseService.updateDocument<Product>(
        COLLECTIONS.PRODUCTS,
        productId,
        { stock_quantity: Math.max(0, newQuantity) }
      )

      auditLogService.log('product_stock_update', 'product', {
        resource_id: productId,
        action_details: {
          newQuantity: Math.max(0, newQuantity),
          barcode: product.barcode,
          name: product.name,
        },
      }).catch(console.error)

      return product
    } catch (error) {
      auditLogService.log('product_stock_update', 'product', {
        resource_id: productId,
        action_details: { newQuantity },
        status: 'failure',
        error_message: error instanceof Error ? error.message : 'Unknown error',
      }).catch(console.error)
      throw error
    }
  },

  /**
   * Calculate stock requirements for a list of packaging items
   * Returns a map of product ID to required quantity
   * Optimized: Uses batch fetch for single products (1 API call instead of N)
   */
  async calculateStockRequirements(
    items: Array<{
      product_barcode: string
      is_bundle?: boolean
      bundle_components?: Array<{
        product: Product
        quantity: number
      }>
    }>
  ): Promise<Map<string, { product: Product; required: number }>> {
    const requirements = new Map<string, { product: Product; required: number }>()

    // Collect barcodes for single products that need to be fetched
    const singleProductBarcodes: string[] = []
    for (const item of items) {
      if (!item.is_bundle || !item.bundle_components) {
        singleProductBarcodes.push(item.product_barcode)
      }
    }

    // Batch fetch all single products at once (1 API call)
    const productMap = await this._getByBarcodesInternal(singleProductBarcodes)

    // Process all items
    for (const item of items) {
      if (item.is_bundle && item.bundle_components) {
        // For bundles, deduct from each component
        for (const component of item.bundle_components) {
          const productId = component.product.$id
          const existing = requirements.get(productId)
          if (existing) {
            existing.required += component.quantity
          } else {
            requirements.set(productId, {
              product: component.product,
              required: component.quantity,
            })
          }
        }
      } else {
        // For single products, deduct 1 (use pre-fetched product)
        const product = productMap.get(item.product_barcode)
        if (product) {
          const existing = requirements.get(product.$id)
          if (existing) {
            existing.required += 1
          } else {
            requirements.set(product.$id, { product, required: 1 })
          }
        }
      }
    }

    return requirements
  },

  /**
   * Validate that there is sufficient stock for packaging
   */
  async validateStockForPackaging(
    items: Array<{
      product_barcode: string
      is_bundle?: boolean
      bundle_components?: Array<{
        product: Product
        quantity: number
      }>
    }>
  ): Promise<{
    valid: boolean
    insufficientStock: Array<{
      barcode: string
      name: string
      required: number
      available: number
    }>
  }> {
    const requirements = await this.calculateStockRequirements(items)
    const insufficientStock: Array<{
      barcode: string
      name: string
      required: number
      available: number
    }> = []

    for (const [, { product, required }] of requirements) {
      // Re-fetch product to get latest stock (in case of concurrent updates)
      const latestProduct = await this.getById(product.$id)
      if (latestProduct.stock_quantity < required) {
        insufficientStock.push({
          barcode: latestProduct.barcode,
          name: latestProduct.name,
          required,
          available: latestProduct.stock_quantity,
        })
      }
    }

    return {
      valid: insufficientStock.length === 0,
      insufficientStock,
    }
  },

  /**
   * Deduct stock for packaging items
   * Should be called after packaging record is successfully created
   * Optimized: Uses batch fetch and parallel updates with a single audit log
   */
  async deductStockForPackaging(
    items: Array<{
      product_barcode: string
      is_bundle?: boolean
      bundle_components?: Array<{
        product: Product
        quantity: number
      }>
    }>
  ): Promise<{ success: boolean; errors: string[] }> {
    const requirements = await this.calculateStockRequirements(items)
    const errors: string[] = []
    const stockUpdates: Array<{
      productId: string
      productName: string
      previousStock: number
      newStock: number
    }> = []

    // Batch fetch all products to get latest stock (1 API call)
    const productIds = Array.from(requirements.keys())
    const latestProducts = await this._getByIdsInternal(productIds)

    // Calculate new stock values and validate
    for (const [productId, { product, required }] of requirements) {
      const latestProduct = latestProducts.get(productId)
      if (!latestProduct) {
        errors.push(`Product not found: ${product.name}`)
        continue
      }

      const newStock = latestProduct.stock_quantity - required
      if (newStock < 0) {
        errors.push(
          `Insufficient stock for ${product.name}: required ${required}, available ${latestProduct.stock_quantity}`
        )
        continue
      }

      stockUpdates.push({
        productId,
        productName: product.name,
        previousStock: latestProduct.stock_quantity,
        newStock,
      })
    }

    // If validation errors, don't proceed with updates
    if (errors.length > 0) {
      const result = { success: false, errors }
      auditLogService
        .log('product_stock_deduct', 'product', {
          action_details: {
            itemCount: items.length,
            productsUpdated: 0,
            success: false,
            errors: result.errors,
          },
          status: 'failure',
          error_message: result.errors.join('; '),
        })
        .catch(console.error)
      return result
    }

    // Perform all stock updates in parallel (N API calls, but no audit logs per update)
    const updateResults = await Promise.allSettled(
      stockUpdates.map(({ productId, newStock }) =>
        this._updateStockInternal(productId, newStock)
      )
    )

    // Check for update failures
    const failedUpdates: typeof stockUpdates = []
    updateResults.forEach((result, index) => {
      if (result.status === 'rejected') {
        const update = stockUpdates[index]
        errors.push(`Failed to update stock for ${update.productName}: ${result.reason}`)
        failedUpdates.push(update)
      }
    })

    // If some updates failed, attempt to rollback successful ones
    if (failedUpdates.length > 0) {
      const successfulUpdates = stockUpdates.filter((_, i) => updateResults[i].status === 'fulfilled')
      await Promise.allSettled(
        successfulUpdates.map(({ productId, previousStock }) =>
          this._updateStockInternal(productId, previousStock)
        )
      )
    }

    const result = { success: errors.length === 0, errors }

    // Log a single audit entry for the entire batch operation
    auditLogService
      .log('product_stock_deduct', 'product', {
        action_details: {
          itemCount: items.length,
          productsUpdated: stockUpdates.length - failedUpdates.length,
          updates: stockUpdates.map((u) => ({
            barcode: requirements.get(u.productId)?.product.barcode,
            name: u.productName,
            previous: u.previousStock,
            new: u.newStock,
            deducted: u.previousStock - u.newStock,
          })),
          success: result.success,
        },
        status: result.success ? 'success' : 'failure',
        error_message: result.errors.length > 0 ? result.errors.join('; ') : undefined,
      })
      .catch(console.error)

    return result
  },

  /**
   * Restore stock when a packaging record is deleted
   * Optimized: Uses batch fetch and parallel updates with a single audit log
   */
  async restoreStockForPackaging(
    items: Array<{
      product_barcode: string
      is_bundle?: boolean
      bundle_components?: Array<{
        product: Product
        quantity: number
      }>
    }>
  ): Promise<{ success: boolean; errors: string[] }> {
    const requirements = await this.calculateStockRequirements(items)
    const errors: string[] = []
    const stockUpdates: Array<{
      productId: string
      productName: string
      previousStock: number
      newStock: number
      restored: number
    }> = []

    // Batch fetch all products to get latest stock (1 API call)
    const productIds = Array.from(requirements.keys())
    const latestProducts = await this._getByIdsInternal(productIds)

    // Calculate new stock values
    for (const [productId, { product, required }] of requirements) {
      const latestProduct = latestProducts.get(productId)
      if (!latestProduct) {
        errors.push(`Product not found: ${product.name}`)
        continue
      }

      stockUpdates.push({
        productId,
        productName: product.name,
        previousStock: latestProduct.stock_quantity,
        newStock: latestProduct.stock_quantity + required,
        restored: required,
      })
    }

    // Perform all stock updates in parallel (N API calls, no individual audit logs)
    const updateResults = await Promise.allSettled(
      stockUpdates.map(({ productId, newStock }) =>
        this._updateStockInternal(productId, newStock)
      )
    )

    // Check for update failures
    updateResults.forEach((result, index) => {
      if (result.status === 'rejected') {
        const update = stockUpdates[index]
        errors.push(`Failed to restore stock for ${update.productName}: ${result.reason}`)
      }
    })

    const successCount = updateResults.filter((r) => r.status === 'fulfilled').length
    const result = { success: errors.length === 0, errors }

    // Log a single audit entry for the entire batch operation
    auditLogService
      .log('product_stock_restore', 'product', {
        action_details: {
          itemCount: items.length,
          productsRestored: successCount,
          updates: stockUpdates.map((u) => ({
            barcode: requirements.get(u.productId)?.product.barcode,
            name: u.productName,
            previous: u.previousStock,
            new: u.newStock,
            restored: u.restored,
          })),
          success: result.success,
        },
        status: result.success ? 'success' : 'failure',
        error_message: result.errors.length > 0 ? result.errors.join('; ') : undefined,
      })
      .catch(console.error)

    return result
  },
}

export const productComponentService = {
  /**
   * Add a component to a bundle
   */
  async create(data: CreateProductComponentInput): Promise<ProductComponent> {
    try {
      const component = await databaseService.createDocument<ProductComponent>(
        COLLECTIONS.PRODUCT_COMPONENTS,
        {
          parent_product_id: data.parent_product_id,
          child_product_id: data.child_product_id,
          quantity: data.quantity ?? 1,
        }
      )

      auditLogService.log('product_component_add', 'product_component', {
        resource_id: component.$id,
        action_details: {
          parent_product_id: data.parent_product_id,
          child_product_id: data.child_product_id,
          quantity: data.quantity ?? 1,
        },
      }).catch(console.error)

      return component
    } catch (error) {
      auditLogService.log('product_component_add', 'product_component', {
        action_details: data,
        status: 'failure',
        error_message: error instanceof Error ? error.message : 'Unknown error',
      }).catch(console.error)
      throw error
    }
  },

  /**
   * Get components for a bundle
   */
  async getByParentId(parentProductId: string): Promise<ProductComponent[]> {
    const result = await databaseService.listDocuments<ProductComponent>(
      COLLECTIONS.PRODUCT_COMPONENTS,
      [Query.equal('parent_product_id', parentProductId)]
    )
    return result.documents
  },

  /**
   * Get bundles that contain a specific product
   */
  async getByChildId(childProductId: string): Promise<ProductComponent[]> {
    const result = await databaseService.listDocuments<ProductComponent>(
      COLLECTIONS.PRODUCT_COMPONENTS,
      [Query.equal('child_product_id', childProductId)]
    )
    return result.documents
  },

  /**
   * Update component quantity
   */
  async updateQuantity(
    componentId: string,
    quantity: number
  ): Promise<ProductComponent> {
    try {
      const component = await databaseService.updateDocument<ProductComponent>(
        COLLECTIONS.PRODUCT_COMPONENTS,
        componentId,
        { quantity }
      )

      auditLogService.log('product_component_update', 'product_component', {
        resource_id: componentId,
        action_details: {
          quantity,
          parent_product_id: component.parent_product_id,
          child_product_id: component.child_product_id,
        },
      }).catch(console.error)

      return component
    } catch (error) {
      auditLogService.log('product_component_update', 'product_component', {
        resource_id: componentId,
        action_details: { quantity },
        status: 'failure',
        error_message: error instanceof Error ? error.message : 'Unknown error',
      }).catch(console.error)
      throw error
    }
  },

  /**
   * Remove a component from a bundle
   */
  async delete(componentId: string): Promise<void> {
    try {
      // Get component details before deletion
      let componentDetails: Record<string, unknown> = {}
      try {
        const component = await databaseService.getDocument<ProductComponent>(
          COLLECTIONS.PRODUCT_COMPONENTS,
          componentId
        )
        componentDetails = {
          parent_product_id: component.parent_product_id,
          child_product_id: component.child_product_id,
          quantity: component.quantity,
        }
      } catch {
        // Component may not exist, continue with deletion
      }

      await databaseService.deleteDocument(
        COLLECTIONS.PRODUCT_COMPONENTS,
        componentId
      )

      auditLogService.log('product_component_remove', 'product_component', {
        resource_id: componentId,
        action_details: componentDetails,
      }).catch(console.error)
    } catch (error) {
      auditLogService.log('product_component_remove', 'product_component', {
        resource_id: componentId,
        status: 'failure',
        error_message: error instanceof Error ? error.message : 'Unknown error',
      }).catch(console.error)
      throw error
    }
  },

  /**
   * Remove all components from a bundle
   * @param parentProductId - The parent bundle product ID
   * @param delayMs - Optional delay between delete operations to avoid rate limiting
   */
  async deleteAllForParent(parentProductId: string, delayMs = 0): Promise<void> {
    const components = await this.getByParentId(parentProductId)
    for (const component of components) {
      if (delayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, delayMs))
      }
      await databaseService.deleteDocument(
        COLLECTIONS.PRODUCT_COMPONENTS,
        component.$id
      )
    }
  },
}
