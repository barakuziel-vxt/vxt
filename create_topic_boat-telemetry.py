from confluent_kafka.admin import AdminClient, NewTopic


def setup_kafka_topics(bootstrap_servers: str = "localhost:9092", topic_name: str = "boat-telemetry",
					   num_partitions: int = 3, replication_factor: int = 1):
	"""Create Kafka/Redpanda topic if it does not exist.

	Defaults are appropriate for a local PoC: 3 partitions (allows parallelism) and
	replication factor 1 (single-node).
	"""
	# connect to admin
	admin_client = AdminClient({"bootstrap.servers": bootstrap_servers})

	new_topic = NewTopic(topic_name, num_partitions=num_partitions, replication_factor=replication_factor)

	# create_topics returns a dict of futures
	fs = admin_client.create_topics([new_topic])

	# check results
	for t, fut in fs.items():
		try:
			fut.result()
			print(f"Topic '{t}' created successfully.")
		except Exception as e:
			msg = str(e)
			if "Topic already exists" in msg or "already exists" in msg:
				print(f"Topic '{t}' already exists, skipping.")
			else:
				print(f"Failed to create topic '{t}': {e}")


if __name__ == "__main__":
	setup_kafka_topics()