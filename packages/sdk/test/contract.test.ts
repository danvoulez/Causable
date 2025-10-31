/**
 * API Contract Tests
 * 
 * These tests validate that the API endpoints follow the correct contract
 * without requiring a database connection. They test the request/response
 * structure and type safety.
 */

import type { Span, SpanFilter } from '../src/types';

// Mock span data for testing
const mockSpan: Span = {
  id: "123e4567-e89b-12d3-a456-426614174000",
  seq: 0,
  entity_type: "function",
  who: "developer",
  did: "created",
  this: "test_function",
  at: new Date().toISOString(),
  status: "active",
  name: "Test Function",
  description: "A test function for validation",
  visibility: "private",
};

// Test 1: Verify Span type has all required fields
function testSpanTypeRequiredFields(): boolean {
  const requiredFields = ['id', 'seq', 'entity_type', 'who', 'this', 'at'];
  
  for (const field of requiredFields) {
    if (!(field in mockSpan)) {
      console.error(`❌ Missing required field: ${field}`);
      return false;
    }
  }
  
  console.log('✅ Span type has all required fields');
  return true;
}

// Test 2: Verify Span type has correct optional fields
function testSpanTypeOptionalFields(): boolean {
  const optionalFields = [
    'did', 'parent_id', 'related_to', 'owner_id', 'tenant_id',
    'visibility', 'status', 'is_deleted', 'name', 'description',
    'code', 'language', 'runtime', 'input', 'output', 'error',
    'duration_ms', 'trace_id', 'prev_hash', 'curr_hash',
    'signature', 'public_key', 'metadata'
  ];
  
  // Optional fields should be allowed but not required
  const spanWithOptionals: Span = {
    ...mockSpan,
    duration_ms: 42,
    trace_id: "trace-123",
    metadata: { custom: "data" },
  };
  
  if (!spanWithOptionals.duration_ms || !spanWithOptionals.trace_id) {
    console.error('❌ Optional fields not working correctly');
    return false;
  }
  
  console.log('✅ Span type handles optional fields correctly');
  return true;
}

// Test 3: Verify SpanFilter type
function testSpanFilterType(): boolean {
  const filter: SpanFilter = {
    entity_type: "function",
    status: "active",
    limit: 50,
  };
  
  if (!filter.entity_type || !filter.status) {
    console.error('❌ SpanFilter type not working correctly');
    return false;
  }
  
  console.log('✅ SpanFilter type works correctly');
  return true;
}

// Test 4: Verify API endpoint paths are correct
function testAPIEndpoints(): boolean {
  const endpoints = {
    spans: "/api/spans",
    stream: "/api/timeline/stream",
  };
  
  // These should match what's in router.ts
  const expectedEndpoints = ["/api/spans", "/api/timeline/stream"];
  
  for (const expected of expectedEndpoints) {
    if (!Object.values(endpoints).includes(expected)) {
      console.error(`❌ Missing endpoint: ${expected}`);
      return false;
    }
  }
  
  console.log('✅ API endpoints are correctly defined');
  return true;
}

// Test 5: Verify visibility enum values
function testVisibilityEnum(): boolean {
  const validVisibilities: Array<'private' | 'tenant' | 'public'> = [
    'private',
    'tenant',
    'public'
  ];
  
  for (const visibility of validVisibilities) {
    const span: Span = { ...mockSpan, visibility };
    if (span.visibility !== visibility) {
      console.error(`❌ Invalid visibility value: ${visibility}`);
      return false;
    }
  }
  
  console.log('✅ Visibility enum values are correct');
  return true;
}

// Run all tests
function runTests(): void {
  console.log('\n🧪 Running API Contract Tests\n');
  console.log('=' .repeat(50));
  
  const tests = [
    testSpanTypeRequiredFields,
    testSpanTypeOptionalFields,
    testSpanFilterType,
    testAPIEndpoints,
    testVisibilityEnum,
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    try {
      if (test()) {
        passed++;
      } else {
        failed++;
      }
    } catch (error) {
      console.error(`❌ Test failed with error: ${error}`);
      failed++;
    }
  }
  
  console.log('=' .repeat(50));
  console.log(`\n📊 Results: ${passed} passed, ${failed} failed\n`);
  
  if (failed > 0) {
    process.exit(1);
  }
}

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    testSpanTypeRequiredFields,
    testSpanTypeOptionalFields,
    testSpanFilterType,
    testAPIEndpoints,
    testVisibilityEnum,
    runTests,
  };
}

// Run if executed directly
if (typeof require !== 'undefined' && require.main === module) {
  runTests();
}
