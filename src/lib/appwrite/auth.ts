import type { Models } from 'appwrite'

import { account, ID } from './config'
import {
  auditLogService,
  clearAuditSession,
  initAuditSession,
  setAuditUserContext,
} from './audit-log'

export type User = Models.User<Models.Preferences>

export const authService = {
  async createAccount(email: string, password: string, name?: string) {
    try {
      const user = await account.create(ID.unique(), email, password, name)
      await this.login(email, password)

      // Log account creation (after login sets context)
      auditLogService.createAuditLog({
        user_id: user.$id,
        user_email: email,
        action_type: 'auth_create_account',
        resource_type: 'auth',
        resource_id: user.$id,
        action_details: { email, name },
        status: 'success',
      }).catch(console.error)

      return user
    } catch (error) {
      auditLogService.createAuditLog({
        user_id: 'unknown',
        user_email: email,
        action_type: 'auth_create_account',
        resource_type: 'auth',
        action_details: { email, name },
        status: 'failure',
        error_message: error instanceof Error ? error.message : 'Unknown error',
      }).catch(console.error)
      throw error
    }
  },

  async login(email: string, password: string) {
    try {
      const session = await account.createEmailPasswordSession(email, password)

      // Initialize audit session
      initAuditSession()

      // Get user details for context
      const user = await account.get()
      setAuditUserContext({
        user_id: user.$id,
        user_email: user.email,
        session_id: session.$id,
      })

      // Log successful login
      auditLogService.createAuditLog({
        user_id: user.$id,
        user_email: user.email,
        action_type: 'auth_login',
        resource_type: 'auth',
        resource_id: session.$id,
        action_details: { email },
        status: 'success',
        session_id: session.$id,
      }).catch(console.error)

      return session
    } catch (error) {
      auditLogService.createAuditLog({
        user_id: 'unknown',
        user_email: email,
        action_type: 'auth_login',
        resource_type: 'auth',
        action_details: { email },
        status: 'failure',
        error_message: error instanceof Error ? error.message : 'Unknown error',
      }).catch(console.error)
      throw error
    }
  },

  async logout() {
    try {
      // Get user before logout for logging
      const user = await this.getCurrentUser()

      await account.deleteSession('current')

      // Log logout before clearing context
      if (user) {
        auditLogService.createAuditLog({
          user_id: user.$id,
          user_email: user.email,
          action_type: 'auth_logout',
          resource_type: 'auth',
          status: 'success',
        }).catch(console.error)
      }

      // Clear audit context and session
      setAuditUserContext(null)
      clearAuditSession()
    } catch (error) {
      // Still try to clear context even on error
      setAuditUserContext(null)
      clearAuditSession()
      throw error
    }
  },

  async deleteCurrentSession() {
    return account.deleteSession('current')
  },

  async hasActiveSession(): Promise<boolean> {
    try {
      await account.get()
      return true
    } catch {
      return false
    }
  },

  async getCurrentUser(): Promise<User | null> {
    try {
      return await account.get()
    } catch {
      return null
    }
  },

  async updateName(name: string) {
    try {
      const result = await account.updateName(name)
      auditLogService.log('auth_update_name', 'auth', {
        resource_id: result.$id,
        action_details: { name },
      }).catch(console.error)
      return result
    } catch (error) {
      auditLogService.log('auth_update_name', 'auth', {
        action_details: { name },
        status: 'failure',
        error_message: error instanceof Error ? error.message : 'Unknown error',
      }).catch(console.error)
      throw error
    }
  },

  async updateEmail(email: string, password: string) {
    try {
      const result = await account.updateEmail(email, password)
      auditLogService.log('auth_update_email', 'auth', {
        resource_id: result.$id,
        action_details: { newEmail: email },
      }).catch(console.error)
      return result
    } catch (error) {
      auditLogService.log('auth_update_email', 'auth', {
        action_details: { newEmail: email },
        status: 'failure',
        error_message: error instanceof Error ? error.message : 'Unknown error',
      }).catch(console.error)
      throw error
    }
  },

  async updatePassword(password: string, oldPassword: string) {
    try {
      const result = await account.updatePassword(password, oldPassword)
      auditLogService.log('auth_update_password', 'auth', {
        resource_id: result.$id,
      }).catch(console.error)
      return result
    } catch (error) {
      auditLogService.log('auth_update_password', 'auth', {
        status: 'failure',
        error_message: error instanceof Error ? error.message : 'Unknown error',
      }).catch(console.error)
      throw error
    }
  },

  async createPasswordRecovery(email: string, url: string) {
    try {
      const result = await account.createRecovery(email, url)
      // Note: No user context for password recovery - use email
      auditLogService.createAuditLog({
        user_id: 'unknown',
        user_email: email,
        action_type: 'auth_password_recovery_request',
        resource_type: 'auth',
        action_details: { email },
        status: 'success',
      }).catch(console.error)
      return result
    } catch (error) {
      auditLogService.createAuditLog({
        user_id: 'unknown',
        user_email: email,
        action_type: 'auth_password_recovery_request',
        resource_type: 'auth',
        action_details: { email },
        status: 'failure',
        error_message: error instanceof Error ? error.message : 'Unknown error',
      }).catch(console.error)
      throw error
    }
  },

  async confirmPasswordRecovery(
    userId: string,
    secret: string,
    password: string
  ) {
    try {
      const result = await account.updateRecovery(userId, secret, password)
      auditLogService.createAuditLog({
        user_id: userId,
        action_type: 'auth_password_recovery_confirm',
        resource_type: 'auth',
        resource_id: userId,
        status: 'success',
      }).catch(console.error)
      return result
    } catch (error) {
      auditLogService.createAuditLog({
        user_id: userId,
        action_type: 'auth_password_recovery_confirm',
        resource_type: 'auth',
        resource_id: userId,
        status: 'failure',
        error_message: error instanceof Error ? error.message : 'Unknown error',
      }).catch(console.error)
      throw error
    }
  },

  async createEmailVerification(url: string) {
    try {
      const result = await account.createVerification(url)
      auditLogService.log('auth_email_verification_request', 'auth').catch(console.error)
      return result
    } catch (error) {
      auditLogService.log('auth_email_verification_request', 'auth', {
        status: 'failure',
        error_message: error instanceof Error ? error.message : 'Unknown error',
      }).catch(console.error)
      throw error
    }
  },

  async confirmEmailVerification(userId: string, secret: string) {
    try {
      const result = await account.updateVerification(userId, secret)
      auditLogService.createAuditLog({
        user_id: userId,
        action_type: 'auth_email_verification_confirm',
        resource_type: 'auth',
        resource_id: userId,
        status: 'success',
      }).catch(console.error)
      return result
    } catch (error) {
      auditLogService.createAuditLog({
        user_id: userId,
        action_type: 'auth_email_verification_confirm',
        resource_type: 'auth',
        resource_id: userId,
        status: 'failure',
        error_message: error instanceof Error ? error.message : 'Unknown error',
      }).catch(console.error)
      throw error
    }
  },
}
