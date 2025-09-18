import { BaseRepository } from './BaseRepository';
import { Token } from '../entities/Token';

export class TokenRepository extends BaseRepository<Token> {
  constructor() {
    super(Token, 'Token');
  }
}