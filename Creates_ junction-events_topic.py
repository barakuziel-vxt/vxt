"""
Kafka Topic Setup Script
Creates the junction-events topic for Junction event streaming
"""

import sys
import logging
from kafka.admin import KafkaAdminClient, NewTopic
from kafka.errors import TopicAlreadyExistsError, KafkaError

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class KafkaTopicSetup:
    def __init__(self, bootstrap_servers='localhost:9092'):
        self.bootstrap_servers = bootstrap_servers
        self.admin_client = None
        
    def connect(self):
        """Connect to Kafka cluster"""
        try:
            self.admin_client = KafkaAdminClient(
                bootstrap_servers=self.bootstrap_servers,
                client_id='topic-creator'
            )
            logger.info(f"Connected to Kafka at {self.bootstrap_servers}")
            return True
        except Exception as e:
            logger.error(f"Failed to connect to Kafka: {e}")
            return False
    
    def create_topic(self, 
                    topic_name='junction-events',
                    num_partitions=3,
                    replication_factor=1):
        """Create Kafka topic"""
        try:
            # Create topic configuration
            topic = NewTopic(
                name=topic_name,
                num_partitions=num_partitions,
                replication_factor=replication_factor,
                topic_configs={
                    'retention.ms': '604800000',  # 7 days retention
                    'compression.type': 'snappy'  # Enable compression
                }
            )
            
            logger.info(f"Creating topic: {topic_name}")
            logger.info(f"  Partitions: {num_partitions}")
            logger.info(f"  Replication Factor: {replication_factor}")
            
            # Create the topic
            fs = self.admin_client.create_topics(new_topics=[topic], validate_only=False)
            
            # Wait for topic creation
            for topic_name, future in fs.items():
                try:
                    future.result()  # The result itself is None
                    logger.info(f"[OK] Topic '{topic_name}' created successfully!")
                except TopicAlreadyExistsError:
                    logger.info(f"[OK] Topic '{topic_name}' already exists")
                except KafkaError as e:
                    logger.error(f"[ERROR] Failed to create topic '{topic_name}': {e}")
                    return False
            
            return True
            
        except Exception as e:
            logger.error(f"Error creating topic: {e}")
            return False
    
    def list_topics(self):
        """List all topics in the cluster"""
        try:
            metadata = self.admin_client.describe_cluster()
            logger.info("Cluster Information:")
            logger.info(f"  Cluster ID: {metadata.get('ClusterId', 'N/A')}")
            logger.info(f"  Controller: {metadata.get('Controller', 'N/A')}")
            logger.info(f"  Brokers: {metadata.get('Brokers', 'N/A')}")
            
            # Get topic list
            topics = self.admin_client.list_topics()
            logger.info("\nAvailable Topics:")
            for topic in topics.keys():
                logger.info(f"  - {topic}")
            
            return True
        except Exception as e:
            logger.error(f"Error listing topics: {e}")
            return False
    
    def delete_topic(self, topic_name='junction-events'):
        """Delete a topic"""
        try:
            logger.info(f"Deleting topic: {topic_name}")
            fs = self.admin_client.delete_topics(topics=[topic_name], validate_only=False)
            
            for topic, future in fs.items():
                try:
                    future.result()
                    logger.info(f"[OK] Topic '{topic}' deleted successfully!")
                except Exception as e:
                    logger.error(f"[ERROR] Failed to delete topic '{topic}': {e}")
                    return False
            
            return True
        except Exception as e:
            logger.error(f"Error deleting topic: {e}")
            return False
    
    def describe_topic(self, topic_name='junction-events'):
        """Get detailed information about a topic"""
        try:
            topics = self.admin_client.describe_topics(topics=[topic_name])
            
            logger.info(f"\nTopic Details: {topic_name}")
            for topic_name, topic_metadata in topics.items():
                logger.info(f"  Topic: {topic_metadata.name}")
                logger.info(f"  Partitions: {len(topic_metadata.partitions)}")
                logger.info(f"  Error: {topic_metadata.error}")
                
                for partition in topic_metadata.partitions:
                    logger.info(f"\n  Partition {partition.partition}:")
                    logger.info(f"    Leader: {partition.leader}")
                    logger.info(f"    Replicas: {partition.replicas}")
                    logger.info(f"    ISR (In-Sync Replicas): {partition.isr}")
            
            return True
        except Exception as e:
            logger.error(f"Error describing topic: {e}")
            return False
    
    def close(self):
        """Close admin client connection"""
        if self.admin_client:
            self.admin_client.close()
            logger.info("Disconnected from Kafka")


def main():
    """Main execution function"""
    import argparse
    
    parser = argparse.ArgumentParser(
        description='Kafka Topic Setup Manager',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''
Examples:
  # Create default topic
  python setup_kafka_topic.py

  # Create topic with custom settings
  python setup_kafka_topic.py --topic my-events --partitions 5 --replication-factor 2

  # List all topics
  python setup_kafka_topic.py --list

  # Describe a specific topic
  python setup_kafka_topic.py --describe junction-events

  # Delete a topic
  python setup_kafka_topic.py --delete junction-events
        '''
    )
    
    parser.add_argument('--bootstrap-servers', 
                       default='localhost:9092',
                       help='Kafka bootstrap servers (default: localhost:9092)')
    
    parser.add_argument('--topic',
                       default='junction-events',
                       help='Topic name (default: junction-events)')
    
    parser.add_argument('--partitions',
                       type=int,
                       default=3,
                       help='Number of partitions (default: 3)')
    
    parser.add_argument('--replication-factor',
                       type=int,
                       default=1,
                       help='Replication factor (default: 1)')
    
    parser.add_argument('--create',
                       action='store_true',
                       help='Create topic (default action)')
    
    parser.add_argument('--list',
                       action='store_true',
                       help='List all topics')
    
    parser.add_argument('--describe',
                       metavar='TOPIC',
                       help='Describe a specific topic')
    
    parser.add_argument('--delete',
                       metavar='TOPIC',
                       help='Delete a topic')
    
    args = parser.parse_args()
    
    # Create setup instance
    setup = KafkaTopicSetup(bootstrap_servers=args.bootstrap_servers)
    
    # Connect to Kafka
    if not setup.connect():
        sys.exit(1)
    
    success = True
    
    try:
        if args.list:
            # List topics
            success = setup.list_topics()
        elif args.describe:
            # Describe specific topic
            success = setup.describe_topic(args.describe)
        elif args.delete:
            # Delete topic
            logger.warning(f"About to delete topic: {args.delete}")
            confirm = input("Are you sure? (yes/no): ")
            if confirm.lower() == 'yes':
                success = setup.delete_topic(args.delete)
            else:
                logger.info("Deletion cancelled")
        else:
            # Create topic (default)
            success = setup.create_topic(
                topic_name=args.topic,
                num_partitions=args.partitions,
                replication_factor=args.replication_factor
            )
            # List topics to verify
            setup.list_topics()
    
    finally:
        setup.close()
    
    sys.exit(0 if success else 1)


if __name__ == '__main__':
    logger.info("=" * 70)
    logger.info("Kafka Topic Setup Manager")
    logger.info("=" * 70)
    main()