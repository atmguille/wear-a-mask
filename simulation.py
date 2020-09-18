import math
import random
import itertools

from typing import List, Tuple

# Global variables
SIZE = 10
N_PERSONS = 100
INFECTED_PERCENTAGE = 0.2
MASKS_PERCENTAGE = 0.5
MINIMUM_DISTANCE = 1

INFECTED = math.floor(N_PERSONS * INFECTED_PERCENTAGE)
MASKS = math.floor(N_PERSONS * MASKS_PERCENTAGE)


class Person:
    # Probabilities of infection based on wearing masks or not. First element: infected, second: to_infect
    PROBABILITIES = {(False, False): 0.9, (False, True): 0.7, (True, False): 0.05, (True, True): 0.015}
    __id = 0

    def __init__(self, x: int, y: int, infected: bool, mask: bool):
        self.id = Person.__id
        Person.__id += 1
        self.x = x
        self.y = y
        self.is_infected = infected
        self.wearing_mask = mask

    def is_close(self, other: 'Person'):
        """
        :param other
        :return: True if two persons are closer than the minimum_distance
        """
        return abs(self.x - other.x) <= MINIMUM_DISTANCE and abs(self.y - other.y) <= MINIMUM_DISTANCE

    def should_infect(self, to_infect: 'Person') -> bool:
        """
        Function called by the INFECTED to check if he should infect to_infect,
        executing a random test based on probabilities depending on wearing masks
        :param to_infect: Person
        :return: True if infected, False if not
        """
        probability = Person.PROBABILITIES[self.wearing_mask, to_infect.wearing_mask]
        if random.random() < probability:
            return True
        else:
            return False

    @staticmethod
    def check_infection(person1: 'Person', person2: 'Person') -> Tuple[bool, bool]:
        """
        Checks if there is a new infection between the two persons, returning a new updated copy
        of the person that gets infected and the same object for the person that does not. This is done
        :param person1:
        :param person2:
        :return: person1_updated, person2_updated
        """
        global INFECTED
        # Discard if contagion is impossible to happen
        if not person1.is_close(person2) or (person1.is_infected and person2.is_infected) or \
                (not person1.is_infected and not person2.is_infected):
            return False, False

        if person1.is_infected and person1.should_infect(person2):
            return False, True
        elif person2.is_infected and person2.should_infect(person1):
            return True, False
        else:
            return False, False


def population_init() -> List[Person]:
    """
    Choose position, if infected and if masked for each Person, following proportions
    :return: array with all persons created (population)
    """
    # Randomly choose initial position of each Person
    total_indexes = [(i, j) for i in range(SIZE) for j in range(SIZE)]
    location_indexes = random.sample(total_indexes, k=N_PERSONS)

    # Randomly choose who is infected and who will wear a mask
    infected_indexes = [True]*INFECTED + [False]*(N_PERSONS-INFECTED)
    masks_indexes = [True]*MASKS + [False]*(N_PERSONS-MASKS)
    random.shuffle(infected_indexes)
    random.shuffle(masks_indexes)

    population = []
    for (x, y), infected, mask in zip(location_indexes, infected_indexes, masks_indexes):
        population.append(Person(x, y, infected, mask))

    return population


def simulation():
    global INFECTED

    population = population_init()

    while INFECTED < N_PERSONS:
        print(INFECTED)
        should_update = [False] * N_PERSONS
        for person1, person2 in itertools.combinations(population, 2):
            p1_got_infected, p2_got_infected = Person.check_infection(person1, person2)
            should_update[person1.id] = should_update[person1.id] or p1_got_infected
            should_update[person2.id] = should_update[person2.id] or p2_got_infected

        for person in population:
            if should_update[person.id]:
                INFECTED += 1
                person.is_infected = True

        # TODO: moves


if __name__ == '__main__':
    simulation()
